import type { Config } from "@/types";
import { databaseOpenEnsured } from "./databaseOpenEnsured.js";
import type { DatabaseSessionRow, SessionDbRecord } from "./databaseTypes.js";
import { sessionDbParse } from "./sessionDbParse.js";

/**
 * Lists all sessions for one agent ordered by creation time.
 * Expects: db schema is migrated before access.
 */
export async function sessionDbListForAgent(
  config: Config,
  agentId: string
): Promise<SessionDbRecord[]> {
  const db = databaseOpenEnsured(config.dbPath);
  try {
    const rows = db
      .prepare("SELECT * FROM sessions WHERE agent_id = ? ORDER BY created_at ASC")
      .all(agentId) as DatabaseSessionRow[];
    return rows.map((row) => sessionDbParse(row));
  } finally {
    db.close();
  }
}
