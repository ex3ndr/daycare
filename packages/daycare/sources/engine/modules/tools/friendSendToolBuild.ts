import type { ToolResultMessage } from "@mariozechner/pi-ai";
import { type Static, Type } from "@sinclair/typebox";
import type { ToolDefinition, ToolResultContract } from "@/types";
import { xmlEscape } from "../../../util/xmlEscape.js";
import { contextForAgent } from "../../agents/context.js";
import { messageBuildSystemText } from "../../messages/messageBuildSystemText.js";

const schema = Type.Object(
    {
        usertag: Type.String({ minLength: 1 }),
        message: Type.String({ minLength: 1 })
    },
    { additionalProperties: false }
);

type FriendSendArgs = Static<typeof schema>;

const resultSchema = Type.Object(
    {
        summary: Type.String(),
        usertag: Type.String()
    },
    { additionalProperties: false }
);

type FriendSendResult = Static<typeof resultSchema>;

const returns: ToolResultContract<FriendSendResult> = {
    schema: resultSchema,
    toLLMText: (result) => result.summary
};

/**
 * Sends a direct message to a friend by usertag.
 * Expects: caller and target are connected with both request flags set.
 */
export function friendSendToolBuild(): ToolDefinition {
    return {
        tool: {
            name: "friend_send",
            description: "Send a direct message to a friend by usertag.",
            parameters: schema
        },
        returns,
        visibleByDefault: (context) => context.descriptor.type === "user",
        execute: async (args, toolContext, toolCall) => {
            const payload = args as FriendSendArgs;
            const targetUsertag = usertagNormalize(payload.usertag);
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
            const myUsertag = me.usertag?.trim() ?? "";
            if (!myUsertag) {
                throw new Error("Current user does not have a usertag.");
            }

            const target = await users.findByUsertag(targetUsertag);
            if (!target) {
                throw new Error(`User not found for usertag: ${targetUsertag}`);
            }
            if (target.id === me.id) {
                throw new Error("Cannot send to yourself.");
            }

            const connection = await connections.find(me.id, target.id);
            const origin = `friend:${myUsertag}`;
            const item = {
                type: "system_message",
                origin,
                text: messageBuildSystemText(`Message from ${myUsertag}: ${xmlEscape(message)}`, origin)
            } as const;

            if (target.parentUserId) {
                if (!connection || !connection.requestedA || !connection.requestedB) {
                    throw new Error(`No active shared access to ${targetUsertag}.`);
                }
                const agents = await toolContext.agentSystem.storage.agents.findMany();
                const gateway = agents.find(
                    (agent) => agent.descriptor.type === "subuser" && agent.descriptor.id === target.id
                );
                if (!gateway) {
                    throw new Error(`Gateway agent not found for shared subuser ${targetUsertag}.`);
                }
                await toolContext.agentSystem.post(
                    contextForAgent({ userId: target.id, agentId: gateway.id }),
                    { agentId: gateway.id },
                    item
                );
            } else {
                if (!connection || !connection.requestedA || !connection.requestedB) {
                    throw new Error(`You are not friends with ${targetUsertag}.`);
                }
                await toolContext.agentSystem.postToUserAgents(target.id, item);
            }

            const summary = `Sent message to ${targetUsertag}.`;
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
                    usertag: targetUsertag
                }
            };
        }
    };
}

function usertagNormalize(value: string): string {
    const normalized = value.trim().toLowerCase();
    if (!normalized) {
        throw new Error("usertag is required.");
    }
    return normalized;
}
