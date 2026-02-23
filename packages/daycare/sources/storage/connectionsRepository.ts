import type { DatabaseSync } from "node:sqlite";
import type { ConnectionDbRecord, DatabaseConnectionRow } from "./databaseTypes.js";

/**
 * Connections repository backed by SQLite.
 * Expects: schema migrations already applied for connections.
 */
export class ConnectionsRepository {
    private readonly db: DatabaseSync;

    constructor(db: DatabaseSync) {
        this.db = db;
    }

    async upsertRequest(requesterId: string, targetId: string, requestedAt = Date.now()): Promise<ConnectionDbRecord> {
        const [userAId, userBId] = sortPair(requesterId, targetId);
        if (requesterId === userAId) {
            this.db
                .prepare(
                    `
                    INSERT INTO connections (
                        user_a_id,
                        user_b_id,
                        requested_a,
                        requested_b,
                        requested_a_at,
                        requested_b_at
                    ) VALUES (?, ?, 1, 0, ?, NULL)
                    ON CONFLICT(user_a_id, user_b_id) DO UPDATE SET
                        requested_a = 1,
                        requested_a_at = excluded.requested_a_at
                `
                )
                .run(userAId, userBId, requestedAt);
        } else {
            this.db
                .prepare(
                    `
                    INSERT INTO connections (
                        user_a_id,
                        user_b_id,
                        requested_a,
                        requested_b,
                        requested_a_at,
                        requested_b_at
                    ) VALUES (?, ?, 0, 1, NULL, ?)
                    ON CONFLICT(user_a_id, user_b_id) DO UPDATE SET
                        requested_b = 1,
                        requested_b_at = excluded.requested_b_at
                `
                )
                .run(userAId, userBId, requestedAt);
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
            this.db
                .prepare(
                    `
                    UPDATE connections
                    SET requested_a = 0
                    WHERE user_a_id = ? AND user_b_id = ?
                `
                )
                .run(userAId, userBId);
        } else {
            this.db
                .prepare(
                    `
                    UPDATE connections
                    SET requested_b = 0
                    WHERE user_a_id = ? AND user_b_id = ?
                `
                )
                .run(userAId, userBId);
        }
        return this.find(userAId, userBId);
    }

    async find(id1: string, id2: string): Promise<ConnectionDbRecord | null> {
        const [userAId, userBId] = sortPair(id1, id2);
        const row = this.db
            .prepare(
                `
                SELECT *
                FROM connections
                WHERE user_a_id = ? AND user_b_id = ?
                LIMIT 1
            `
            )
            .get(userAId, userBId) as DatabaseConnectionRow | undefined;
        if (!row) {
            return null;
        }
        return connectionParse(row);
    }

    async findFriends(userId: string): Promise<ConnectionDbRecord[]> {
        const rows = this.db
            .prepare(
                `
                SELECT *
                FROM connections
                WHERE (user_a_id = ? OR user_b_id = ?)
                    AND requested_a = 1
                    AND requested_b = 1
                ORDER BY user_a_id ASC, user_b_id ASC
            `
            )
            .all(userId, userId) as DatabaseConnectionRow[];
        return rows.map((row) => connectionParse(row));
    }

    async delete(id1: string, id2: string): Promise<boolean> {
        const [userAId, userBId] = sortPair(id1, id2);
        const removed = this.db
            .prepare("DELETE FROM connections WHERE user_a_id = ? AND user_b_id = ?")
            .run(userAId, userBId);
        const rawChanges = (removed as { changes?: number | bigint }).changes;
        const changes = typeof rawChanges === "bigint" ? Number(rawChanges) : (rawChanges ?? 0);
        return changes > 0;
    }
}

function connectionParse(row: DatabaseConnectionRow): ConnectionDbRecord {
    return {
        userAId: row.user_a_id,
        userBId: row.user_b_id,
        requestedA: row.requested_a === 1,
        requestedB: row.requested_b === 1,
        requestedAAt: row.requested_a_at,
        requestedBAt: row.requested_b_at
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
