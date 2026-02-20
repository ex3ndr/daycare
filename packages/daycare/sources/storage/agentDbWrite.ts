import type { Config } from "@/types";
import type { AgentDbRecord } from "./databaseTypes.js";
import { databaseOpenEnsured } from "./databaseOpenEnsured.js";

/**
 * Upserts one agent row in SQLite storage.
 * Expects: descriptor/type pair is consistent for the same agent id.
 */
export async function agentDbWrite(config: Config, record: AgentDbRecord): Promise<void> {
  const db = databaseOpenEnsured(config.dbPath);
  try {
    db.prepare(
      `
        INSERT INTO agents (
          id,
          type,
          descriptor,
          active_session_id,
          permissions,
          tokens,
          stats,
          lifecycle,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          type = excluded.type,
          descriptor = excluded.descriptor,
          active_session_id = excluded.active_session_id,
          permissions = excluded.permissions,
          tokens = excluded.tokens,
          stats = excluded.stats,
          lifecycle = excluded.lifecycle,
          created_at = excluded.created_at,
          updated_at = excluded.updated_at
      `
    ).run(
      record.id,
      record.type,
      JSON.stringify(record.descriptor),
      record.activeSessionId,
      JSON.stringify(record.permissions),
      record.tokens ? JSON.stringify(record.tokens) : null,
      JSON.stringify(record.stats),
      record.lifecycle,
      record.createdAt,
      record.updatedAt
    );
  } finally {
    db.close();
  }
}
