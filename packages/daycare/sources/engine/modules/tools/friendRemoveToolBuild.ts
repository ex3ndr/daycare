import type { ToolResultMessage } from "@mariozechner/pi-ai";
import { type Static, Type } from "@sinclair/typebox";
import type { ToolDefinition, ToolResultContract } from "@/types";
import { messageBuildSystemText } from "../../messages/messageBuildSystemText.js";

const schema = Type.Object(
    {
        nametag: Type.String({ minLength: 1 })
    },
    { additionalProperties: false }
);

type FriendRemoveArgs = Static<typeof schema>;

const resultSchema = Type.Object(
    {
        summary: Type.String(),
        status: Type.String(),
        nametag: Type.String()
    },
    { additionalProperties: false }
);

type FriendRemoveResult = Static<typeof resultSchema>;

const returns: ToolResultContract<FriendRemoveResult> = {
    schema: resultSchema,
    toLLMText: (result) => result.summary
};

/**
 * Removes, rejects, or cancels a friend relationship by nametag.
 * Expects: caller is a frontend user with a generated nametag.
 */
export function friendRemoveToolBuild(): ToolDefinition {
    return {
        tool: {
            name: "friend_remove",
            description: "Unfriend, reject a request, or cancel a pending request by nametag.",
            parameters: schema
        },
        returns,
        visibleByDefault: (context) => context.descriptor.type === "user",
        execute: async (args, toolContext, toolCall) => {
            const payload = args as FriendRemoveArgs;
            const targetNametag = nametagNormalize(payload.nametag);
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
                throw new Error("Cannot remove yourself.");
            }

            const connection = await connections.find(me.id, target.id);
            if (!connection) {
                throw new Error(`No relationship with ${targetNametag}.`);
            }

            const state = sideStateForUser(connection, me.id);
            if (target.parentUserId) {
                if (state.myRequested && state.otherRequested) {
                    const updated = await connections.clearSide(me.id, target.id);
                    await connectionDeleteIfEmpty(connections, target.id, me.id, updated);

                    const owner = await users.findById(target.parentUserId);
                    if (owner) {
                        const origin = `friend:${myNametag}`;
                        await toolContext.agentSystem.postToUserAgents(owner.id, {
                            type: "system_message",
                            origin,
                            text: messageBuildSystemText(
                                `${myNametag} removed access to subuser "${target.name ?? target.id}" (${targetNametag}).`,
                                origin
                            )
                        });
                    }
                    return success("removed_share", targetNametag, toolCall);
                }
                if (!state.myRequested && state.otherRequested) {
                    const updated = await connections.clearSide(target.id, me.id);
                    await connectionDeleteIfEmpty(connections, target.id, me.id, updated);
                    return success("rejected_share", targetNametag, toolCall);
                }
                if (state.myRequested && !state.otherRequested) {
                    const updated = await connections.clearSide(me.id, target.id);
                    await connectionDeleteIfEmpty(connections, target.id, me.id, updated);
                    return success("canceled_share", targetNametag, toolCall);
                }

                throw new Error(`No relationship with ${targetNametag}.`);
            }

            if (state.myRequested && state.otherRequested) {
                await connections.clearSide(me.id, target.id);
                await subuserShareCleanup(connections, me.id, target.id);
                const origin = `friend:${myNametag}`;
                await toolContext.agentSystem.postToUserAgents(target.id, {
                    type: "system_message",
                    origin,
                    text: messageBuildSystemText(`${myNametag} removed you as a friend.`, origin)
                });
                return success("unfriended", targetNametag, toolCall);
            }
            if (!state.myRequested && state.otherRequested) {
                await connections.clearSide(target.id, me.id);
                return success("rejected", targetNametag, toolCall);
            }
            if (state.myRequested && !state.otherRequested) {
                await connections.clearSide(me.id, target.id);
                return success("canceled", targetNametag, toolCall);
            }

            throw new Error(`No relationship with ${targetNametag}.`);
        }
    };
}

function success(status: FriendRemoveResult["status"], nametag: string, toolCall: { id: string; name: string }) {
    const summary =
        status === "unfriended"
            ? `Removed ${nametag} from friends.`
            : status === "rejected"
              ? `Rejected friend request from ${nametag}.`
              : status === "removed_share"
                ? `Removed shared access to ${nametag}.`
                : status === "rejected_share"
                  ? `Rejected shared subuser offer from ${nametag}.`
                  : status === "canceled_share"
                    ? `Canceled pending shared subuser access to ${nametag}.`
                    : `Canceled pending friend request to ${nametag}.`;
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

async function subuserShareCleanup(
    connections: {
        findConnectionsWithSubusersOf: (
            friendUserId: string,
            ownerUserId: string
        ) => Promise<Array<{ userAId: string; userBId: string }>>;
        delete: (id1: string, id2: string) => Promise<boolean>;
    },
    myUserId: string,
    friendUserId: string
): Promise<void> {
    const [outgoing, incoming] = await Promise.all([
        connections.findConnectionsWithSubusersOf(friendUserId, myUserId),
        connections.findConnectionsWithSubusersOf(myUserId, friendUserId)
    ]);

    const pairKeys = new Set(
        [...outgoing, ...incoming].map((connection) => `${connection.userAId}:${connection.userBId}`)
    );
    await Promise.all(
        Array.from(pairKeys).map(async (pair) => {
            const [left, right] = pair.split(":");
            if (!left || !right) {
                return;
            }
            await connections.delete(left, right);
        })
    );
}

async function connectionDeleteIfEmpty(
    connections: { delete: (id1: string, id2: string) => Promise<boolean> },
    id1: string,
    id2: string,
    connection: {
        requestedA: boolean;
        requestedB: boolean;
    } | null
): Promise<void> {
    if (!connection) {
        return;
    }
    if (connection.requestedA || connection.requestedB) {
        return;
    }
    await connections.delete(id1, id2);
}
