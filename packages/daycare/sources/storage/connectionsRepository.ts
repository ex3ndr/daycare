import { and, asc, eq, isNull, or, sql } from "drizzle-orm";
import type { DaycareDb } from "../schema.js";
import { connectionsTable, usersTable } from "../schema.js";
import type { ConnectionDbRecord } from "./databaseTypes.js";
import { versionAdvance } from "./versionAdvance.js";

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
        const current = await this.find(userAId, userBId);
        if (!current) {
            await this.db.insert(connectionsTable).values({
                userAId,
                userBId,
                version: 1,
                validFrom: requestedAt,
                validTo: null,
                requestedA: requesterId === userAId ? 1 : 0,
                requestedB: requesterId === userBId ? 1 : 0,
                requestedAAt: requesterId === userAId ? requestedAt : null,
                requestedBAt: requesterId === userBId ? requestedAt : null
            });
        } else if (requesterId === userAId) {
            await versionAdvance<ConnectionDbRecord>({
                now: requestedAt,
                changes: {
                    requestedA: true,
                    requestedAAt: requestedAt
                },
                findCurrent: async () => current,
                closeCurrent: async (row, now) => {
                    await this.db
                        .update(connectionsTable)
                        .set({ validTo: now })
                        .where(
                            and(
                                eq(connectionsTable.userAId, row.userAId),
                                eq(connectionsTable.userBId, row.userBId),
                                eq(connectionsTable.version, row.version ?? 1),
                                isNull(connectionsTable.validTo)
                            )
                        );
                },
                insertNext: async (row) => {
                    await this.db.insert(connectionsTable).values({
                        userAId: row.userAId,
                        userBId: row.userBId,
                        version: row.version ?? 1,
                        validFrom: row.validFrom ?? 0,
                        validTo: row.validTo ?? null,
                        requestedA: row.requestedA ? 1 : 0,
                        requestedB: row.requestedB ? 1 : 0,
                        requestedAAt: row.requestedAAt,
                        requestedBAt: row.requestedBAt
                    });
                }
            });
        } else {
            await versionAdvance<ConnectionDbRecord>({
                now: requestedAt,
                changes: {
                    requestedB: true,
                    requestedBAt: requestedAt
                },
                findCurrent: async () => current,
                closeCurrent: async (row, now) => {
                    await this.db
                        .update(connectionsTable)
                        .set({ validTo: now })
                        .where(
                            and(
                                eq(connectionsTable.userAId, row.userAId),
                                eq(connectionsTable.userBId, row.userBId),
                                eq(connectionsTable.version, row.version ?? 1),
                                isNull(connectionsTable.validTo)
                            )
                        );
                },
                insertNext: async (row) => {
                    await this.db.insert(connectionsTable).values({
                        userAId: row.userAId,
                        userBId: row.userBId,
                        version: row.version ?? 1,
                        validFrom: row.validFrom ?? 0,
                        validTo: row.validTo ?? null,
                        requestedA: row.requestedA ? 1 : 0,
                        requestedB: row.requestedB ? 1 : 0,
                        requestedAAt: row.requestedAAt,
                        requestedBAt: row.requestedBAt
                    });
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
        const current = await this.find(userAId, userBId);
        if (!current) {
            return null;
        }
        await versionAdvance<ConnectionDbRecord>({
            changes: userId === userAId ? { requestedA: false } : { requestedB: false },
            findCurrent: async () => current,
            closeCurrent: async (row, now) => {
                await this.db
                    .update(connectionsTable)
                    .set({ validTo: now })
                    .where(
                        and(
                            eq(connectionsTable.userAId, row.userAId),
                            eq(connectionsTable.userBId, row.userBId),
                            eq(connectionsTable.version, row.version ?? 1),
                            isNull(connectionsTable.validTo)
                        )
                    );
            },
            insertNext: async (row) => {
                await this.db.insert(connectionsTable).values({
                    userAId: row.userAId,
                    userBId: row.userBId,
                    version: row.version ?? 1,
                    validFrom: row.validFrom ?? 0,
                    validTo: row.validTo ?? null,
                    requestedA: row.requestedA ? 1 : 0,
                    requestedB: row.requestedB ? 1 : 0,
                    requestedAAt: row.requestedAAt,
                    requestedBAt: row.requestedBAt
                });
            }
        });
        return this.find(userAId, userBId);
    }

    async find(id1: string, id2: string): Promise<ConnectionDbRecord | null> {
        const [userAId, userBId] = sortPair(id1, id2);
        const rows = await this.db
            .select()
            .from(connectionsTable)
            .where(
                and(
                    eq(connectionsTable.userAId, userAId),
                    eq(connectionsTable.userBId, userBId),
                    isNull(connectionsTable.validTo)
                )
            )
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
                    isNull(connectionsTable.validTo),
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
                version: connectionsTable.version,
                validFrom: connectionsTable.validFrom,
                validTo: connectionsTable.validTo,
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
            .where(
                and(
                    eq(usersTable.parentUserId, ownerUserId),
                    isNull(usersTable.validTo),
                    isNull(connectionsTable.validTo)
                )
            )
            .orderBy(asc(connectionsTable.userAId), asc(connectionsTable.userBId));
        return rows.map((row) => connectionParse(row));
    }

    async findConnectionsWithSubusersOf(friendUserId: string, ownerUserId: string): Promise<ConnectionDbRecord[]> {
        const rows = await this.db
            .select({
                userAId: connectionsTable.userAId,
                userBId: connectionsTable.userBId,
                version: connectionsTable.version,
                validFrom: connectionsTable.validFrom,
                validTo: connectionsTable.validTo,
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
            .where(
                and(
                    eq(usersTable.parentUserId, ownerUserId),
                    isNull(usersTable.validTo),
                    isNull(connectionsTable.validTo)
                )
            )
            .orderBy(asc(connectionsTable.userAId), asc(connectionsTable.userBId));
        return rows.map((row) => connectionParse(row));
    }

    async delete(id1: string, id2: string): Promise<boolean> {
        const [userAId, userBId] = sortPair(id1, id2);
        const current = await this.find(userAId, userBId);
        if (!current) {
            return false;
        }
        await this.db
            .update(connectionsTable)
            .set({ validTo: Date.now() })
            .where(
                and(
                    eq(connectionsTable.userAId, current.userAId),
                    eq(connectionsTable.userBId, current.userBId),
                    eq(connectionsTable.version, current.version ?? 1),
                    isNull(connectionsTable.validTo)
                )
            );
        return true;
    }
}

function connectionParse(row: {
    userAId: string;
    userBId: string;
    version: number;
    validFrom: number;
    validTo: number | null;
    requestedA: number;
    requestedB: number;
    requestedAAt: number | null;
    requestedBAt: number | null;
}): ConnectionDbRecord {
    return {
        userAId: row.userAId,
        userBId: row.userBId,
        version: row.version ?? 1,
        validFrom: row.validFrom ?? 0,
        validTo: row.validTo ?? null,
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
