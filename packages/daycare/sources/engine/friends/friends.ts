import type { Context } from "@/types";
import type { Storage } from "../../storage/storage.js";
import { messageBuildSystemText } from "../messages/messageBuildSystemText.js";
import { TOPO_EVENT_TYPES, TOPO_SOURCE_FRIENDS, topographyObservationEmit } from "../observations/topographyEvents.js";

const FRIEND_COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000;

export type FriendsOptions = {
    storage: Pick<Storage, "users" | "connections" | "observationLog">;
    postToUserAgents: (userId: string, item: { type: "system_message"; origin: string; text: string }) => Promise<void>;
};

export type FriendsAddResult = {
    status: "requested" | "accepted" | "accepted_share";
    nametag: string;
};

export type FriendsRemoveResult = {
    status: "unfriended" | "rejected" | "canceled" | "removed_share" | "rejected_share" | "canceled_share";
    nametag: string;
};

export type FriendsShareSubuserResult = {
    status: "offered";
    friendNametag: string;
    subuserId: string;
    subuserNametag: string;
};

export type FriendsUnshareSubuserResult = {
    status: "revoked";
    friendNametag: string;
    subuserId: string;
};

/**
 * Coordinates friendship and subuser-sharing mutations.
 * Expects: caller context belongs to a user-level agent.
 */
export class Friends {
    private readonly storage: Pick<Storage, "users" | "connections" | "observationLog">;
    private readonly postToUserAgents: (
        userId: string,
        item: { type: "system_message"; origin: string; text: string }
    ) => Promise<void>;

    constructor(options: FriendsOptions) {
        this.storage = options.storage;
        this.postToUserAgents = options.postToUserAgents;
    }

    async add(ctx: Context, input: { nametag: string }): Promise<FriendsAddResult> {
        const targetNametag = nametagNormalize(input.nametag);
        const users = this.storage.users;
        const connections = this.storage.connections;

        const me = await users.findById(ctx.userId);
        if (!me) {
            throw new Error("Current user not found.");
        }
        const myNametag = me.nametag;
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
            const ownerTag = owner.nametag;
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
            await this.postToUserAgents(owner.id, {
                type: "system_message",
                origin,
                text: messageBuildSystemText(
                    `${myNametag} accepted access to subuser "${target.name ?? target.id}" (${targetNametag}).`,
                    origin
                )
            });
            await this.subuserSharedEmit(target.id, target.name ?? target.id, owner.id, me.id, me.nametag);
            return { status: "accepted_share", nametag: targetNametag };
        }

        const existing = await connections.find(me.id, target.id);
        if (!existing) {
            await connections.upsertRequest(me.id, target.id, now);
            await this.postToUserAgents(target.id, {
                type: "system_message",
                origin,
                text: messageBuildSystemText(
                    `User ${myNametag} wants to be your friend. Use friend_add("${myNametag}") to accept.`,
                    origin
                )
            });
            await this.friendRequestedEmit(me.id, target.id, targetNametag);
            return { status: "requested", nametag: targetNametag };
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
            await this.postToUserAgents(target.id, {
                type: "system_message",
                origin,
                text: messageBuildSystemText(`${myNametag} accepted your friend request. You are now friends.`, origin)
            });
            await this.friendAcceptedEmit(me.id, target.id, targetNametag);
            return { status: "accepted", nametag: targetNametag };
        }
        if (state.myRequestedAt && now - state.myRequestedAt < FRIEND_COOLDOWN_MS) {
            throw new Error(`Friend request cooldown is active for ${targetNametag}. Try again later.`);
        }

        await connections.upsertRequest(me.id, target.id, now);
        await this.postToUserAgents(target.id, {
            type: "system_message",
            origin,
            text: messageBuildSystemText(
                `User ${myNametag} wants to be your friend. Use friend_add("${myNametag}") to accept.`,
                origin
            )
        });
        await this.friendRequestedEmit(me.id, target.id, targetNametag);
        return { status: "requested", nametag: targetNametag };
    }

    async remove(ctx: Context, input: { nametag: string }): Promise<FriendsRemoveResult> {
        const targetNametag = nametagNormalize(input.nametag);
        const users = this.storage.users;
        const connections = this.storage.connections;

        const me = await users.findById(ctx.userId);
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
            const subuserName = target.name ?? target.id;
            if (state.myRequested && state.otherRequested) {
                const updated = await connections.clearSide(me.id, target.id);
                await connectionDeleteIfEmpty(connections, target.id, me.id, updated);

                const owner = await users.findById(target.parentUserId);
                if (owner) {
                    const origin = `friend:${myNametag}`;
                    await this.postToUserAgents(owner.id, {
                        type: "system_message",
                        origin,
                        text: messageBuildSystemText(
                            `${myNametag} removed access to subuser "${target.name ?? target.id}" (${targetNametag}).`,
                            origin
                        )
                    });
                }
                await this.subuserUnsharedEmit(target.id, subuserName, target.parentUserId, me.id, me.nametag);
                return { status: "removed_share", nametag: targetNametag };
            }
            if (!state.myRequested && state.otherRequested) {
                const updated = await connections.clearSide(target.id, me.id);
                await connectionDeleteIfEmpty(connections, target.id, me.id, updated);
                await this.subuserUnsharedEmit(target.id, subuserName, target.parentUserId, me.id, me.nametag);
                return { status: "rejected_share", nametag: targetNametag };
            }
            if (state.myRequested && !state.otherRequested) {
                const updated = await connections.clearSide(me.id, target.id);
                await connectionDeleteIfEmpty(connections, target.id, me.id, updated);
                await this.subuserUnsharedEmit(target.id, subuserName, target.parentUserId, me.id, me.nametag);
                return { status: "canceled_share", nametag: targetNametag };
            }

            throw new Error(`No relationship with ${targetNametag}.`);
        }

        if (state.myRequested && state.otherRequested) {
            await connections.clearSide(me.id, target.id);
            await subuserShareCleanup(connections, me.id, target.id);
            const origin = `friend:${myNametag}`;
            await this.postToUserAgents(target.id, {
                type: "system_message",
                origin,
                text: messageBuildSystemText(`${myNametag} removed you as a friend.`, origin)
            });
            await this.friendRemovedEmit(me.id, target.id, targetNametag);
            return { status: "unfriended", nametag: targetNametag };
        }
        if (!state.myRequested && state.otherRequested) {
            await connections.clearSide(target.id, me.id);
            await this.friendRemovedEmit(me.id, target.id, targetNametag);
            return { status: "rejected", nametag: targetNametag };
        }
        if (state.myRequested && !state.otherRequested) {
            await connections.clearSide(me.id, target.id);
            await this.friendRemovedEmit(me.id, target.id, targetNametag);
            return { status: "canceled", nametag: targetNametag };
        }

        throw new Error(`No relationship with ${targetNametag}.`);
    }

    async shareSubuser(
        ctx: Context,
        input: { friendNametag: string; subuserId: string }
    ): Promise<FriendsShareSubuserResult> {
        const targetNametag = nametagNormalize(input.friendNametag);
        const subuserId = input.subuserId.trim();
        if (!subuserId) {
            throw new Error("subuserId is required.");
        }

        const users = this.storage.users;
        const connections = this.storage.connections;

        const me = await users.findById(ctx.userId);
        if (!me) {
            throw new Error("Current user not found.");
        }
        const myNametag = me.nametag;

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

        const subuserNametag = subuser.nametag;

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
        await this.postToUserAgents(friend.id, {
            type: "system_message",
            origin,
            text: messageBuildSystemText(
                `${myNametag} shared subuser "${subuserName}" (${subuserNametag}) with you. Use friend_add("${subuserNametag}") to accept.`,
                origin
            )
        });

        return {
            status: "offered",
            friendNametag: targetNametag,
            subuserId,
            subuserNametag
        };
    }

    async unshareSubuser(
        ctx: Context,
        input: { friendNametag: string; subuserId: string }
    ): Promise<FriendsUnshareSubuserResult> {
        const targetNametag = nametagNormalize(input.friendNametag);
        const subuserId = input.subuserId.trim();
        if (!subuserId) {
            throw new Error("subuserId is required.");
        }

        const users = this.storage.users;
        const connections = this.storage.connections;
        const me = await users.findById(ctx.userId);
        if (!me) {
            throw new Error("Current user not found.");
        }
        const myNametag = me.nametag;

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
        const subuserNametag = subuser.nametag;
        await this.postToUserAgents(friend.id, {
            type: "system_message",
            origin,
            text: messageBuildSystemText(
                `${myNametag} revoked your access to subuser "${subuserName}" (${subuserNametag}).`,
                origin
            )
        });
        await this.subuserUnsharedEmit(subuser.id, subuserName, me.id, friend.id, friend.nametag);

        return {
            status: "revoked",
            friendNametag: targetNametag,
            subuserId
        };
    }

    private async friendRequestedEmit(fromUserId: string, toUserId: string, toNametag: string | null): Promise<void> {
        await topographyObservationEmit(this.storage.observationLog, {
            userId: fromUserId,
            type: TOPO_EVENT_TYPES.FRIEND_REQUESTED,
            source: TOPO_SOURCE_FRIENDS,
            message: `Friend request sent to ${toNametag ?? toUserId}`,
            details: `Friend request from ${fromUserId} to ${toUserId} (${toNametag ?? "unknown"})`,
            data: {
                fromUserId,
                toUserId,
                toNametag
            },
            scopeIds: [fromUserId, toUserId]
        });
    }

    private async friendAcceptedEmit(userAId: string, userBId: string, nametag: string | null): Promise<void> {
        await topographyObservationEmit(this.storage.observationLog, {
            userId: userAId,
            type: TOPO_EVENT_TYPES.FRIEND_ACCEPTED,
            source: TOPO_SOURCE_FRIENDS,
            message: `Friend accepted: ${nametag ?? userBId}`,
            details: `Friend connection active between ${userAId} and ${userBId}`,
            data: {
                userAId,
                userBId,
                nametag
            },
            scopeIds: [userAId, userBId]
        });
    }

    private async friendRemovedEmit(userAId: string, userBId: string, nametag: string | null): Promise<void> {
        await topographyObservationEmit(this.storage.observationLog, {
            userId: userAId,
            type: TOPO_EVENT_TYPES.FRIEND_REMOVED,
            source: TOPO_SOURCE_FRIENDS,
            message: `Friend removed: ${nametag ?? userBId}`,
            details: `Friend connection removed between ${userAId} and ${userBId}`,
            data: {
                userAId,
                userBId,
                nametag
            },
            scopeIds: [userAId, userBId]
        });
    }

    private async subuserSharedEmit(
        subuserId: string,
        subuserName: string,
        ownerUserId: string,
        friendUserId: string,
        friendNametag: string | null
    ): Promise<void> {
        await topographyObservationEmit(this.storage.observationLog, {
            userId: ownerUserId,
            type: TOPO_EVENT_TYPES.FRIEND_SUBUSER_SHARED,
            source: TOPO_SOURCE_FRIENDS,
            message: `Subuser shared: ${subuserName} -> ${friendNametag ?? friendUserId}`,
            details: `Subuser ${subuserId} shared from ${ownerUserId} to friend ${friendUserId}`,
            data: {
                subuserId,
                subuserName,
                ownerUserId,
                friendUserId,
                friendNametag
            },
            scopeIds: [ownerUserId, friendUserId]
        });
    }

    private async subuserUnsharedEmit(
        subuserId: string,
        subuserName: string,
        ownerUserId: string,
        friendUserId: string,
        friendNametag: string | null
    ): Promise<void> {
        await topographyObservationEmit(this.storage.observationLog, {
            userId: ownerUserId,
            type: TOPO_EVENT_TYPES.FRIEND_SUBUSER_UNSHARED,
            source: TOPO_SOURCE_FRIENDS,
            message: `Subuser unshared: ${subuserName} -> ${friendNametag ?? friendUserId}`,
            details: `Subuser ${subuserId} unshared from friend ${friendUserId}`,
            data: {
                subuserId,
                subuserName,
                ownerUserId,
                friendUserId,
                friendNametag
            },
            scopeIds: [ownerUserId, friendUserId]
        });
    }
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
        requestedAAt?: number | null;
        requestedBAt?: number | null;
    } | null,
    userId: string
): {
    myRequested: boolean;
    otherRequested: boolean;
    myRequestedAt: number | null;
} {
    if (!connection) {
        return {
            myRequested: false,
            otherRequested: false,
            myRequestedAt: null
        };
    }
    if (connection.userAId === userId) {
        return {
            myRequested: connection.requestedA,
            otherRequested: connection.requestedB,
            myRequestedAt: connection.requestedAAt ?? null
        };
    }
    return {
        myRequested: connection.requestedB,
        otherRequested: connection.requestedA,
        myRequestedAt: connection.requestedBAt ?? null
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
