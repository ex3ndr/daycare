import type { ToolResultMessage } from "@mariozechner/pi-ai";
import { type Static, Type } from "@sinclair/typebox";
import type { ToolDefinition, ToolResultContract } from "@/types";
import { xmlEscape } from "../../../util/xmlEscape.js";
import { messageBuildSystemText } from "../../messages/messageBuildSystemText.js";

const schema = Type.Object(
    {
        nametag: Type.String({ minLength: 1 }),
        message: Type.String({ minLength: 1 })
    },
    { additionalProperties: false }
);

type FriendSendArgs = Static<typeof schema>;

const resultSchema = Type.Object(
    {
        summary: Type.String(),
        nametag: Type.String()
    },
    { additionalProperties: false }
);

type FriendSendResult = Static<typeof resultSchema>;

const returns: ToolResultContract<FriendSendResult> = {
    schema: resultSchema,
    toLLMText: (result) => result.summary
};

/**
 * Sends a direct message to a friend by nametag.
 * Expects: caller and target are connected with both request flags set.
 */
export function friendSendToolBuild(): ToolDefinition {
    return {
        tool: {
            name: "friend_send",
            description: "Send a direct message to a friend by nametag.",
            parameters: schema
        },
        returns,
        visibleByDefault: (context) => context.config.foreground === true,
        execute: async (args, toolContext, toolCall) => {
            const payload = args as FriendSendArgs;
            const targetNametag = nametagNormalize(payload.nametag);
            const message = payload.message.trim();
            if (!message) {
                throw new Error("message is required.");
            }

            const users = toolContext.agentSystem.storage.users;
            const connections = toolContext.agentSystem.storage.connections;
            const me = await users.findById(toolContext.ctx.userId);
            if (!me) {
                throw new Error("Current user not found.");
            }
            const myNametag = me.nametag;

            const target = await users.findByNametag(targetNametag);
            if (!target) {
                throw new Error(`User not found for nametag: ${targetNametag}`);
            }
            if (target.id === me.id) {
                throw new Error("Cannot send to yourself.");
            }

            const connection = await connections.find(me.id, target.id);
            const origin = `friend:${myNametag}`;
            const item = {
                type: "system_message",
                origin,
                text: messageBuildSystemText(`Message from ${myNametag}: ${xmlEscape(message)}`, origin)
            } as const;

            if (!connection || !connection.requestedA || !connection.requestedB) {
                throw new Error(`You are not friends with ${targetNametag}.`);
            }
            await toolContext.agentSystem.postToUserAgents(target.id, item);

            const summary = `Sent message to ${targetNametag}.`;
            const toolMessage: ToolResultMessage = {
                role: "toolResult",
                toolCallId: toolCall.id,
                toolName: toolCall.name,
                content: [{ type: "text", text: summary }],
                isError: false,
                timestamp: Date.now()
            };
            return {
                toolMessage,
                typedResult: {
                    summary,
                    nametag: targetNametag
                }
            };
        }
    };
}

function nametagNormalize(value: string): string {
    const normalized = value.trim().toLowerCase();
    if (!normalized) {
        throw new Error("nametag is required.");
    }
    return normalized;
}
