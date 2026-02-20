import type { AgentHistoryRecord, Config } from "@/types";
import { databaseOpenEnsured } from "./databaseOpenEnsured.js";
import type { DatabaseSessionHistoryRow } from "./databaseTypes.js";
import { sessionHistoryRecordParse } from "./sessionHistoryRecordParse.js";

/**
 * Loads all history records for a session ordered by append id.
 * Expects: db schema is migrated before access.
 */
export async function sessionHistoryDbLoad(
  config: Config,
  sessionId: string
): Promise<AgentHistoryRecord[]> {
  const db = databaseOpenEnsured(config.dbPath);
  try {
    const rows = db
      .prepare("SELECT * FROM session_history WHERE session_id = ? ORDER BY id ASC")
      .all(sessionId) as DatabaseSessionHistoryRow[];

    return rows
      .map((row) => sessionHistoryRecordParse(row))
      .filter((record): record is AgentHistoryRecord => record !== null);
  } finally {
    db.close();
  }
}
