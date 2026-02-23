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

type FriendShareSubuserArgs = Static<typeof schema>;

const resultSchema = Type.Object(
    {
        summary: Type.String(),
        status: Type.String(),
        friendUsertag: Type.String(),
        subuserId: Type.String(),
        subuserUsertag: Type.String()
    },
    { additionalProperties: false }
);

type FriendShareSubuserResult = Static<typeof resultSchema>;

const returns: ToolResultContract<FriendShareSubuserResult> = {
    schema: resultSchema,
    toLLMText: (result) => result.summary
};

/**
 * Shares one of the caller-owned subusers with an existing friend.
 * Expects: caller owns subuserId and caller is already friends with friendUsertag.
 */
export function friendShareSubuserToolBuild(): ToolDefinition {
    return {
        tool: {
            name: "friend_share_subuser",
            description: "Share one of your subusers with a friend by usertag.",
            parameters: schema
        },
        returns,
        visibleByDefault: (context) => context.descriptor.type !== "subuser",
        execute: async (args, toolContext, toolCall) => {
            const payload = args as FriendShareSubuserArgs;
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
            if (friend.id === me.id) {
                throw new Error("Cannot share a subuser with yourself.");
            }
            if (friend.parentUserId) {
                throw new Error("Can only share subusers with primary users.");
            }

            const subuser = await users.findById(subuserId);
            if (!subuser) {
                throw new Error("Subuser not found.");
            }
            if (subuser.parentUserId !== me.id) {
                throw new Error("Subuser does not belong to the calling user.");
            }

            const subuserUsertag = subuser.usertag?.trim() ?? "";
            if (!subuserUsertag) {
                throw new Error("Subuser does not have a usertag.");
            }

            const friendship = await connections.find(me.id, friend.id);
            if (!friendship || !friendship.requestedA || !friendship.requestedB) {
                throw new Error(`You are not friends with ${targetUsertag}.`);
            }

            const existingShare = await connections.find(subuser.id, friend.id);
            if (existingShare?.requestedA && existingShare.requestedB) {
                throw new Error(`Subuser ${subuserId} is already shared with ${targetUsertag}.`);
            }
            const shareSideState = sideStateForUser(existingShare, subuser.id);
            if (shareSideState.myRequested && !shareSideState.otherRequested) {
                throw new Error(`A share request for subuser ${subuserId} is already pending with ${targetUsertag}.`);
            }

            await connections.upsertRequest(subuser.id, friend.id, Date.now());

            const origin = `friend:${myUsertag}`;
            const subuserName = subuser.name ?? subuser.id;
            await toolContext.agentSystem.postToUserAgents(friend.id, {
                type: "system_message",
                origin,
                text: messageBuildSystemText(
                    `${myUsertag} shared subuser "${subuserName}" (${subuserUsertag}) with you. Use friend_add("${subuserUsertag}") to accept.`,
                    origin
                )
            });

            const summary = `Shared subuser ${subuserId} with ${targetUsertag}.`;
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
                    status: "offered",
                    friendUsertag: targetUsertag,
                    subuserId,
                    subuserUsertag
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
    } | null,
    userId: string
): {
    myRequested: boolean;
    otherRequested: boolean;
} {
    if (!connection) {
        return { myRequested: false, otherRequested: false };
    }
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
