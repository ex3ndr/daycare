import { and, asc, eq, or, sql } from "drizzle-orm";
import type { DaycareDb } from "../schema.js";
import { connectionsTable, usersTable } from "../schema.js";
import type { ConnectionDbRecord } from "./databaseTypes.js";

/**
 * Connections repository backed by Drizzle.
 * Expects: schema migrations already applied for connections.
 */
export class ConnectionsRepository {
    private readonly db: DaycareDb;

    constructor(db: DaycareDb) {
        this.db = db;
    }

    async upsertRequest(requesterId: string, targetId: string, requestedAt = Date.now()): Promise<ConnectionDbRecord> {
        const [userAId, userBId] = sortPair(requesterId, targetId);
        if (requesterId === userAId) {
            await this.db
                .insert(connectionsTable)
                .values({
                    userAId,
                    userBId,
                    requestedA: 1,
                    requestedB: 0,
                    requestedAAt: requestedAt,
                    requestedBAt: null
                })
                .onConflictDoUpdate({
                    target: [connectionsTable.userAId, connectionsTable.userBId],
                    set: {
                        requestedA: 1,
                        requestedAAt: requestedAt
                    }
                });
        } else {
            await this.db
                .insert(connectionsTable)
                .values({
                    userAId,
                    userBId,
                    requestedA: 0,
                    requestedB: 1,
                    requestedAAt: null,
                    requestedBAt: requestedAt
                })
                .onConflictDoUpdate({
                    target: [connectionsTable.userAId, connectionsTable.userBId],
                    set: {
                        requestedB: 1,
                        requestedBAt: requestedAt
                    }
                });
        }

        const record = await this.find(userAId, userBId);
        if (!record) {
            throw new Error("Failed to upsert connection request.");
        }
        return record;
    }

    async clearSide(userId: string, otherId: string): Promise<ConnectionDbRecord | null> {
        const [userAId, userBId] = sortPair(userId, otherId);
        if (userId === userAId) {
            await this.db
                .update(connectionsTable)
                .set({ requestedA: 0 })
                .where(and(eq(connectionsTable.userAId, userAId), eq(connectionsTable.userBId, userBId)));
        } else {
            await this.db
                .update(connectionsTable)
                .set({ requestedB: 0 })
                .where(and(eq(connectionsTable.userAId, userAId), eq(connectionsTable.userBId, userBId)));
        }
        return this.find(userAId, userBId);
    }

    async find(id1: string, id2: string): Promise<ConnectionDbRecord | null> {
        const [userAId, userBId] = sortPair(id1, id2);
        const rows = await this.db
            .select()
            .from(connectionsTable)
            .where(and(eq(connectionsTable.userAId, userAId), eq(connectionsTable.userBId, userBId)))
            .limit(1);
        const row = rows[0];
        if (!row) {
            return null;
        }
        return connectionParse(row);
    }

    async findFriends(userId: string): Promise<ConnectionDbRecord[]> {
        const rows = await this.db
            .select()
            .from(connectionsTable)
            .where(
                and(
                    or(eq(connectionsTable.userAId, userId), eq(connectionsTable.userBId, userId)),
                    eq(connectionsTable.requestedA, 1),
                    eq(connectionsTable.requestedB, 1)
                )
            )
            .orderBy(asc(connectionsTable.userAId), asc(connectionsTable.userBId));
        return rows.map((row) => connectionParse(row));
    }

    async findConnectionsForSubusersOf(ownerUserId: string): Promise<ConnectionDbRecord[]> {
        // Use raw SQL for the DISTINCT + JOIN query that Drizzle doesn't easily express
        const rows = await this.db
            .selectDistinct({
                userAId: connectionsTable.userAId,
                userBId: connectionsTable.userBId,
                requestedA: connectionsTable.requestedA,
                requestedB: connectionsTable.requestedB,
                requestedAAt: connectionsTable.requestedAAt,
                requestedBAt: connectionsTable.requestedBAt
            })
            .from(connectionsTable)
            .innerJoin(
                usersTable,
                or(eq(connectionsTable.userAId, usersTable.id), eq(connectionsTable.userBId, usersTable.id))
            )
            .where(eq(usersTable.parentUserId, ownerUserId))
            .orderBy(asc(connectionsTable.userAId), asc(connectionsTable.userBId));
        return rows.map((row) => connectionParse(row));
    }

    async findConnectionsWithSubusersOf(friendUserId: string, ownerUserId: string): Promise<ConnectionDbRecord[]> {
        const rows = await this.db
            .select({
                userAId: connectionsTable.userAId,
                userBId: connectionsTable.userBId,
                requestedA: connectionsTable.requestedA,
                requestedB: connectionsTable.requestedB,
                requestedAAt: connectionsTable.requestedAAt,
                requestedBAt: connectionsTable.requestedBAt
            })
            .from(connectionsTable)
            .innerJoin(
                usersTable,
                or(
                    and(
                        eq(connectionsTable.userAId, usersTable.id),
                        eq(connectionsTable.userBId, sql`${friendUserId}`)
                    ),
                    and(eq(connectionsTable.userBId, usersTable.id), eq(connectionsTable.userAId, sql`${friendUserId}`))
                )
            )
            .where(eq(usersTable.parentUserId, ownerUserId))
            .orderBy(asc(connectionsTable.userAId), asc(connectionsTable.userBId));
        return rows.map((row) => connectionParse(row));
    }

    async delete(id1: string, id2: string): Promise<boolean> {
        const [userAId, userBId] = sortPair(id1, id2);
        const result = await this.db
            .delete(connectionsTable)
            .where(and(eq(connectionsTable.userAId, userAId), eq(connectionsTable.userBId, userBId)))
            .returning({ userAId: connectionsTable.userAId });
        return result.length > 0;
    }
}

function connectionParse(row: {
    userAId: string;
    userBId: string;
    requestedA: number;
    requestedB: number;
    requestedAAt: number | null;
    requestedBAt: number | null;
}): ConnectionDbRecord {
    return {
        userAId: row.userAId,
        userBId: row.userBId,
        requestedA: row.requestedA === 1,
        requestedB: row.requestedB === 1,
        requestedAAt: row.requestedAAt,
        requestedBAt: row.requestedBAt
    };
}

function sortPair(id1: string, id2: string): [string, string] {
    const left = id1.trim();
    const right = id2.trim();
    if (!left || !right) {
        throw new Error("Connection user ids are required.");
    }
    if (left === right) {
        throw new Error("Connection user ids must be different.");
    }
    return left < right ? [left, right] : [right, left];
}
