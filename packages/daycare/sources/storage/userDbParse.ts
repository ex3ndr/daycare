import type { DatabaseUserRow, UserDbRecord } from "./databaseTypes.js";

/**
 * Parses a raw users table row into a typed user record.
 * Expects: integer boolean flags are encoded as 0/1 in SQLite.
 */
export function userDbParse(row: DatabaseUserRow): UserDbRecord {
    return {
        id: row.id,
        isOwner: row.is_owner === 1,
        createdAt: row.created_at,
        updatedAt: row.updated_at
    };
}
