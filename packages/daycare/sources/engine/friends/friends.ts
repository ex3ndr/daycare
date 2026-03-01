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
    status: "requested" | "accepted";
    nametag: string;
};

export type FriendsRemoveResult = {
    status: "unfriended" | "rejected" | "canceled";
    nametag: string;
};

/**
 * Coordinates friendship relationship mutations.
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
        if (state.myRequested && state.otherRequested) {
            await connections.clearSide(me.id, target.id);
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
