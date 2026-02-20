import type { Config } from "@/types";
import { databaseOpenEnsured } from "./databaseOpenEnsured.js";
import type { DatabaseUserConnectorKeyRow, DatabaseUserRow, UserWithConnectorKeysDbRecord } from "./databaseTypes.js";
import { userDbParse } from "./userDbParse.js";

/**
 * Reads one user row and its connector keys by id.
 * Expects: db schema is migrated before access.
 */
export async function userDbRead(config: Config, userId: string): Promise<UserWithConnectorKeysDbRecord | null> {
    const db = databaseOpenEnsured(config.dbPath);
    try {
        const userRow = db.prepare("SELECT * FROM users WHERE id = ? LIMIT 1").get(userId) as
            | DatabaseUserRow
            | undefined;
        if (!userRow) {
            return null;
        }
        const keyRows = db
            .prepare(
                `
          SELECT id, user_id, connector_key
          FROM user_connector_keys
          WHERE user_id = ?
          ORDER BY id ASC
        `
            )
            .all(userId) as DatabaseUserConnectorKeyRow[];
        return {
            ...userDbParse(userRow),
            connectorKeys: keyRows.map((row) => ({
                id: row.id,
                userId: row.user_id,
                connectorKey: row.connector_key
            }))
        };
    } finally {
        db.close();
    }
}
