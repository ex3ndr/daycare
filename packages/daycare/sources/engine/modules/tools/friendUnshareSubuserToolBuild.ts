import type { ToolResultMessage } from "@mariozechner/pi-ai";
import { type Static, Type } from "@sinclair/typebox";
import type { ToolDefinition, ToolResultContract } from "@/types";
import { messageBuildSystemText } from "../../messages/messageBuildSystemText.js";

const schema = Type.Object(
    {
        friendNametag: Type.String({ minLength: 1 }),
        subuserId: Type.String({ minLength: 1 })
    },
    { additionalProperties: false }
);

type FriendUnshareSubuserArgs = Static<typeof schema>;

const resultSchema = Type.Object(
    {
        summary: Type.String(),
        status: Type.String(),
        friendNametag: Type.String(),
        subuserId: Type.String()
    },
    { additionalProperties: false }
);

type FriendUnshareSubuserResult = Static<typeof resultSchema>;

const returns: ToolResultContract<FriendUnshareSubuserResult> = {
    schema: resultSchema,
    toLLMText: (result) => result.summary
};

/**
 * Revokes a previously offered/active subuser share from a friend.
 * Expects: caller owns subuserId and an existing share request from the subuser side is present.
 */
export function friendUnshareSubuserToolBuild(): ToolDefinition {
    return {
        tool: {
            name: "friend_unshare_subuser",
            description: "Revoke a subuser share from a friend by nametag.",
            parameters: schema
        },
        returns,
        visibleByDefault: (context) => context.descriptor.type !== "subuser",
        execute: async (args, toolContext, toolCall) => {
            const payload = args as FriendUnshareSubuserArgs;
            const targetNametag = nametagNormalize(payload.friendNametag);
            const subuserId = payload.subuserId.trim();
            if (!subuserId) {
                throw new Error("subuserId is required.");
            }

            const users = toolContext.agentSystem.storage.users;
            const connections = toolContext.agentSystem.storage.connections;
            const me = await users.findById(toolContext.ctx.userId);
            if (!me) {
                throw new Error("Current user not found.");
            }
            const myNametag = me.nametag?.trim() ?? "";
            if (!myNametag) {
                throw new Error("Current user does not have a nametag.");
            }

            const friend = await users.findByNametag(targetNametag);
            if (!friend) {
                throw new Error(`User not found for nametag: ${targetNametag}`);
            }

            const subuser = await users.findById(subuserId);
            if (!subuser) {
                throw new Error("Subuser not found.");
            }
            if (subuser.parentUserId !== me.id) {
                throw new Error("Subuser does not belong to the calling user.");
            }

            const existing = await connections.find(subuser.id, friend.id);
            if (!existing) {
                throw new Error(`No share exists for subuser ${subuserId} and ${targetNametag}.`);
            }

            const state = sideStateForUser(existing, subuser.id);
            if (!state.myRequested) {
                throw new Error(`No share exists for subuser ${subuserId} and ${targetNametag}.`);
            }

            const updated = await connections.clearSide(subuser.id, friend.id);
            if (updated && !updated.requestedA && !updated.requestedB) {
                await connections.delete(subuser.id, friend.id);
            }

            const origin = `friend:${myNametag}`;
            const subuserName = subuser.name ?? subuser.id;
            const subuserNametag = subuser.nametag?.trim() ?? "unknown";
            await toolContext.agentSystem.postToUserAgents(friend.id, {
                type: "system_message",
                origin,
                text: messageBuildSystemText(
                    `${myNametag} revoked your access to subuser "${subuserName}" (${subuserNametag}).`,
                    origin
                )
            });

            const summary = `Revoked subuser ${subuserId} share from ${targetNametag}.`;
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
                    status: "revoked",
                    friendNametag: targetNametag,
                    subuserId
                }
            };
        }
    };
}

function nametagNormalize(value: string): string {
    const normalized = value.trim().toLowerCase();
    if (!normalized) {
        throw new Error("friendNametag is required.");
    }
    return normalized;
}

function sideStateForUser(
    connection: {
        userAId: string;
        requestedA: boolean;
        requestedB: boolean;
    },
    userId: string
): {
    myRequested: boolean;
    otherRequested: boolean;
} {
    if (connection.userAId === userId) {
        return {
            myRequested: connection.requestedA,
            otherRequested: connection.requestedB
        };
    }
    return {
        myRequested: connection.requestedB,
        otherRequested: connection.requestedA
    };
}
