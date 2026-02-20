import type { Config } from "@/types";
import { databaseOpenEnsured } from "./databaseOpenEnsured.js";
import { userDbRead } from "./userDbRead.js";

/**
 * Reads one user by an exact connector key.
 * Returns: null when no user has the connector key.
 */
export async function userDbReadByConnectorKey(
    config: Config,
    connectorKey: string
): Promise<Awaited<ReturnType<typeof userDbRead>>> {
    const db = databaseOpenEnsured(config.dbPath);
    let userId: string | null = null;
    try {
        const row = db
            .prepare(
                `
          SELECT user_id
          FROM user_connector_keys
          WHERE connector_key = ?
          LIMIT 1
        `
            )
            .get(connectorKey) as { user_id?: string } | undefined;
        userId = row?.user_id ?? null;
    } finally {
        db.close();
    }
    if (!userId) {
        return null;
    }
    return userDbRead(config, userId);
}
