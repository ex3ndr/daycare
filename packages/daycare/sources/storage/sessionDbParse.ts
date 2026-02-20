import type { DatabaseSessionRow, SessionDbRecord } from "./databaseTypes.js";

/**
 * Parses a raw sessions table row into a typed session record.
 * Expects: row columns map to the canonical sessions schema.
 */
export function sessionDbParse(row: DatabaseSessionRow): SessionDbRecord {
  return {
    id: row.id,
    agentId: row.agent_id,
    inferenceSessionId: row.inference_session_id,
    createdAt: row.created_at,
    resetMessage: row.reset_message
  };
}
