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

type FriendShareSubuserArgs = Static<typeof schema>;

const resultSchema = Type.Object(
    {
        summary: Type.String(),
        status: Type.String(),
        friendNametag: Type.String(),
        subuserId: Type.String(),
        subuserNametag: Type.String()
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
 * Expects: caller owns subuserId and caller is already friends with friendNametag.
 */
export function friendShareSubuserToolBuild(): ToolDefinition {
    return {
        tool: {
            name: "friend_share_subuser",
            description: "Share one of your subusers with a friend by nametag.",
            parameters: schema
        },
        returns,
        visibleByDefault: (context) => context.descriptor.type !== "subuser",
        execute: async (args, toolContext, toolCall) => {
            const payload = args as FriendShareSubuserArgs;
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

            const subuserNametag = subuser.nametag?.trim() ?? "";
            if (!subuserNametag) {
                throw new Error("Subuser does not have a nametag.");
            }

            const friendship = await connections.find(me.id, friend.id);
            if (!friendship || !friendship.requestedA || !friendship.requestedB) {
                throw new Error(`You are not friends with ${targetNametag}.`);
            }

            const existingShare = await connections.find(subuser.id, friend.id);
            if (existingShare?.requestedA && existingShare.requestedB) {
                throw new Error(`Subuser ${subuserId} is already shared with ${targetNametag}.`);
            }
            const shareSideState = sideStateForUser(existingShare, subuser.id);
            if (shareSideState.myRequested && !shareSideState.otherRequested) {
                throw new Error(`A share request for subuser ${subuserId} is already pending with ${targetNametag}.`);
            }

            await connections.upsertRequest(subuser.id, friend.id, Date.now());

            const origin = `friend:${myNametag}`;
            const subuserName = subuser.name ?? subuser.id;
            await toolContext.agentSystem.postToUserAgents(friend.id, {
                type: "system_message",
                origin,
                text: messageBuildSystemText(
                    `${myNametag} shared subuser "${subuserName}" (${subuserNametag}) with you. Use friend_add("${subuserNametag}") to accept.`,
                    origin
                )
            });

            const summary = `Shared subuser ${subuserId} with ${targetNametag}.`;
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
                    friendNametag: targetNametag,
                    subuserId,
                    subuserNametag
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
