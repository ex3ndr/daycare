import type { ToolResultMessage } from "@mariozechner/pi-ai";
import { type Static, Type } from "@sinclair/typebox";
import type { ToolDefinition, ToolResultContract } from "@/types";
import { messageBuildSystemText } from "../../messages/messageBuildSystemText.js";

const schema = Type.Object(
    {
        friendUsertag: Type.String({ minLength: 1 }),
        subuserId: Type.String({ minLength: 1 })
    },
    { additionalProperties: false }
);

type FriendUnshareSubuserArgs = Static<typeof schema>;

const resultSchema = Type.Object(
    {
        summary: Type.String(),
        status: Type.String(),
        friendUsertag: Type.String(),
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
            description: "Revoke a subuser share from a friend by usertag.",
            parameters: schema
        },
        returns,
        visibleByDefault: (context) => context.descriptor.type !== "subuser",
        execute: async (args, toolContext, toolCall) => {
            const payload = args as FriendUnshareSubuserArgs;
            const targetUsertag = usertagNormalize(payload.friendUsertag);
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
            const myUsertag = me.usertag?.trim() ?? "";
            if (!myUsertag) {
                throw new Error("Current user does not have a usertag.");
            }

            const friend = await users.findByUsertag(targetUsertag);
            if (!friend) {
                throw new Error(`User not found for usertag: ${targetUsertag}`);
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
                throw new Error(`No share exists for subuser ${subuserId} and ${targetUsertag}.`);
            }

            const state = sideStateForUser(existing, subuser.id);
            if (!state.myRequested) {
                throw new Error(`No share exists for subuser ${subuserId} and ${targetUsertag}.`);
            }

            const updated = await connections.clearSide(subuser.id, friend.id);
            if (updated && !updated.requestedA && !updated.requestedB) {
                await connections.delete(subuser.id, friend.id);
            }

            const origin = `friend:${myUsertag}`;
            const subuserName = subuser.name ?? subuser.id;
            const subuserUsertag = subuser.usertag?.trim() ?? "unknown";
            await toolContext.agentSystem.postToUserAgents(friend.id, {
                type: "system_message",
                origin,
                text: messageBuildSystemText(
                    `${myUsertag} revoked your access to subuser "${subuserName}" (${subuserUsertag}).`,
                    origin
                )
            });

            const summary = `Revoked subuser ${subuserId} share from ${targetUsertag}.`;
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
                    friendUsertag: targetUsertag,
                    subuserId
                }
            };
        }
    };
}

function usertagNormalize(value: string): string {
    const normalized = value.trim().toLowerCase();
    if (!normalized) {
        throw new Error("friendUsertag is required.");
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
