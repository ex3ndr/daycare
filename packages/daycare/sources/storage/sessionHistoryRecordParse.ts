import type { AgentHistoryRecord } from "@/types";
import type { DatabaseSessionHistoryRow } from "./databaseTypes.js";

/**
 * Parses a raw session_history row into an AgentHistoryRecord.
 * Expects: row.type and row.at are canonical; row.data is JSON object text.
 */
export function sessionHistoryRecordParse(row: DatabaseSessionHistoryRow): AgentHistoryRecord | null {
  try {
    const data = JSON.parse(row.data) as Record<string, unknown>;
    return {
      type: row.type as AgentHistoryRecord["type"],
      at: row.at,
      ...data
    } as AgentHistoryRecord;
  } catch {
    return null;
  }
}
