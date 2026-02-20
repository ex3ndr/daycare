import type { Config } from "@/types";
import { databaseOpenEnsured } from "./databaseOpenEnsured.js";
import type { DatabaseUserConnectorKeyRow, DatabaseUserRow, UserWithConnectorKeysDbRecord } from "./databaseTypes.js";
import { userDbParse } from "./userDbParse.js";

/**
 * Lists all users with their connector keys.
 * Expects: db schema is migrated before access.
 */
export async function userDbList(config: Config): Promise<UserWithConnectorKeysDbRecord[]> {
    const db = databaseOpenEnsured(config.dbPath);
    try {
        const userRows = db.prepare("SELECT * FROM users ORDER BY created_at ASC, id ASC").all() as DatabaseUserRow[];
        const keyRows = db
            .prepare(
                `
          SELECT id, user_id, connector_key
          FROM user_connector_keys
          ORDER BY id ASC
        `
            )
            .all() as DatabaseUserConnectorKeyRow[];

        const keysByUserId = new Map<string, DatabaseUserConnectorKeyRow[]>();
        for (const keyRow of keyRows) {
            const rows = keysByUserId.get(keyRow.user_id) ?? [];
            rows.push(keyRow);
            keysByUserId.set(keyRow.user_id, rows);
        }

        return userRows.map((userRow) => ({
            ...userDbParse(userRow),
            connectorKeys: (keysByUserId.get(userRow.id) ?? []).map((keyRow) => ({
                id: keyRow.id,
                userId: keyRow.user_id,
                connectorKey: keyRow.connector_key
            }))
        }));
    } finally {
        db.close();
    }
}
