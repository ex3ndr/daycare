import type { Config } from "@/types";
import { databaseOpenEnsured } from "./databaseOpenEnsured.js";

/**
 * Adds one connector key to a user.
 * Expects: userId exists and connectorKey is globally unique.
 */
export async function userDbConnectorKeyAdd(config: Config, userId: string, connectorKey: string): Promise<void> {
    const db = databaseOpenEnsured(config.dbPath);
    try {
        db.prepare(
            `
        INSERT INTO user_connector_keys (user_id, connector_key)
        VALUES (?, ?)
      `
        ).run(userId, connectorKey);
    } finally {
        db.close();
    }
}
