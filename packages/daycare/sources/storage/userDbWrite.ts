import type { Config } from "@/types";
import { databaseOpenEnsured } from "./databaseOpenEnsured.js";
import type { UserDbRecord } from "./databaseTypes.js";

/**
 * Upserts one user row in SQLite storage.
 * Expects: id is stable for the same logical user.
 */
export async function userDbWrite(config: Config, record: UserDbRecord): Promise<void> {
    const db = databaseOpenEnsured(config.dbPath);
    try {
        db.prepare(
            `
        INSERT INTO users (id, is_owner, created_at, updated_at)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          is_owner = excluded.is_owner,
          created_at = excluded.created_at,
          updated_at = excluded.updated_at
      `
        ).run(record.id, record.isOwner ? 1 : 0, record.createdAt, record.updatedAt);
    } finally {
        db.close();
    }
}
