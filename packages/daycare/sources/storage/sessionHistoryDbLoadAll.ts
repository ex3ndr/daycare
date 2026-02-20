import type { AgentHistoryRecord, Config } from "@/types";
import { databaseOpenEnsured } from "./databaseOpenEnsured.js";
import type { DatabaseSessionHistoryRow } from "./databaseTypes.js";
import { sessionHistoryRecordParse } from "./sessionHistoryRecordParse.js";

/**
 * Loads history records across all sessions for one agent.
 * Expects: records are ordered by session creation and append id.
 */
export async function sessionHistoryDbLoadAll(
  config: Config,
  agentId: string
): Promise<AgentHistoryRecord[]> {
  const db = databaseOpenEnsured(config.dbPath);
  try {
    const rows = db
      .prepare(
        `
          SELECT h.*
          FROM session_history h
          INNER JOIN sessions s ON s.id = h.session_id
          WHERE s.agent_id = ?
          ORDER BY s.created_at ASC, h.id ASC
        `
      )
      .all(agentId) as DatabaseSessionHistoryRow[];

    return rows
      .map((row) => sessionHistoryRecordParse(row))
      .filter((record): record is AgentHistoryRecord => record !== null);
  } finally {
    db.close();
  }
}
