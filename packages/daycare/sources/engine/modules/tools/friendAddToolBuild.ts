import type { ToolResultMessage } from "@mariozechner/pi-ai";
import { type Static, Type } from "@sinclair/typebox";
import type { ToolDefinition, ToolResultContract } from "@/types";
import { messageBuildSystemText } from "../../messages/messageBuildSystemText.js";

const FRIEND_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;

const schema = Type.Object(
    {
        nametag: Type.String({ minLength: 1 })
    },
    { additionalProperties: false }
);

type FriendAddArgs = Static<typeof schema>;

const resultSchema = Type.Object(
    {
        summary: Type.String(),
        status: Type.String(),
        nametag: Type.String()
    },
    { additionalProperties: false }
);

type FriendAddResult = Static<typeof resultSchema>;

const returns: ToolResultContract<FriendAddResult> = {
    schema: resultSchema,
    toLLMText: (result) => result.summary
};

/**
 * Sends or confirms a friend request by nametag.
 * Expects: caller is a frontend user with a generated nametag.
 */
export function friendAddToolBuild(): ToolDefinition {
    return {
        tool: {
            name: "friend_add",
            description: "Send or accept a friend request by nametag.",
            parameters: schema
        },
        returns,
        visibleByDefault: (context) => context.descriptor.type === "user",
        execute: async (args, toolContext, toolCall) => {
            const payload = args as FriendAddArgs;
            const targetNametag = nametagNormalize(payload.nametag);
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
            const origin = `friend:${myNametag}`;
            const now = Date.now();

            const target = await users.findByNametag(targetNametag);
            if (!target) {
                throw new Error(`User not found for nametag: ${targetNametag}`);
            }
            if (target.id === me.id) {
                throw new Error("Cannot add yourself as a friend.");
            }

            if (target.parentUserId) {
                const owner = await users.findById(target.parentUserId);
                if (!owner) {
                    throw new Error("Subuser owner not found.");
                }
                const ownerTag = owner.nametag?.trim() ?? owner.id;
                const ownerConnection = await connections.find(me.id, owner.id);
                if (!ownerConnection || !ownerConnection.requestedA || !ownerConnection.requestedB) {
                    throw new Error(`You are not friends with subuser owner ${ownerTag}.`);
                }

                const subuserShare = await connections.find(me.id, target.id);
                if (!subuserShare) {
                    throw new Error("No pending share request for this subuser.");
                }
                const shareState = sideStateForUser(subuserShare, me.id);
                if (shareState.myRequested && shareState.otherRequested) {
                    throw new Error(`Already connected to shared subuser ${targetNametag}.`);
                }
                if (!shareState.otherRequested) {
                    throw new Error("No pending share request for this subuser.");
                }

                await connections.upsertRequest(me.id, target.id, now);
                await toolContext.agentSystem.postToUserAgents(owner.id, {
                    type: "system_message",
                    origin,
                    text: messageBuildSystemText(
                        `${myNametag} accepted access to subuser "${target.name ?? target.id}" (${targetNametag}).`,
                        origin
                    )
                });
                return success("accepted_share", targetNametag, toolCall);
            }

            const existing = await connections.find(me.id, target.id);
            if (!existing) {
                await connections.upsertRequest(me.id, target.id, now);
                await toolContext.agentSystem.postToUserAgents(target.id, {
                    type: "system_message",
                    origin,
                    text: messageBuildSystemText(
                        `User ${myNametag} wants to be your friend. Use friend_add("${myNametag}") to accept.`,
                        origin
                    )
                });
                return success("requested", targetNametag, toolCall);
            }

            const state = sideStateForUser(existing, me.id);
            if (state.myRequested && state.otherRequested) {
                throw new Error(`Already friends with ${targetNametag}.`);
            }
            if (state.myRequested && !state.otherRequested) {
                throw new Error(`Friend request to ${targetNametag} is already pending.`);
            }
            if (!state.myRequested && state.otherRequested) {
                await connections.upsertRequest(me.id, target.id, now);
                await toolContext.agentSystem.postToUserAgents(target.id, {
                    type: "system_message",
                    origin,
                    text: messageBuildSystemText(
                        `${myNametag} accepted your friend request. You are now friends.`,
                        origin
                    )
                });
                return success("accepted", targetNametag, toolCall);
            }
            if (state.myRequestedAt && now - state.myRequestedAt < FRIEND_COOLDOWN_MS) {
                throw new Error(`Friend request cooldown is active for ${targetNametag}. Try again later.`);
            }

            await connections.upsertRequest(me.id, target.id, now);
            await toolContext.agentSystem.postToUserAgents(target.id, {
                type: "system_message",
                origin,
                text: messageBuildSystemText(
                    `User ${myNametag} wants to be your friend. Use friend_add("${myNametag}") to accept.`,
                    origin
                )
            });
            return success("requested", targetNametag, toolCall);
        }
    };
}

function success(status: FriendAddResult["status"], nametag: string, toolCall: { id: string; name: string }) {
    const summary =
        status === "requested"
            ? `Friend request sent to ${nametag}.`
            : status === "accepted_share"
              ? `Accepted shared access to ${nametag}.`
              : `${nametag} accepted. You are now friends.`;
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
            status,
            nametag
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

function sideStateForUser(
    connection: {
        userAId: string;
        requestedA: boolean;
        requestedB: boolean;
        requestedAAt: number | null;
        requestedBAt: number | null;
    },
    userId: string
): {
    myRequested: boolean;
    otherRequested: boolean;
    myRequestedAt: number | null;
} {
    if (connection.userAId === userId) {
        return {
            myRequested: connection.requestedA,
            otherRequested: connection.requestedB,
            myRequestedAt: connection.requestedAAt
        };
    }
    return {
        myRequested: connection.requestedB,
        otherRequested: connection.requestedA,
        myRequestedAt: connection.requestedBAt
    };
}
