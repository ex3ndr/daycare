import type { Migration } from "./migrationTypes.js";

/**
 * Creates durable inbox storage for queued agent inbox entries.
 * Expects: agents table lifecycle is managed separately; cleanup is explicit.
 */
export const migration20260221AddInbox: Migration = {
    name: "20260221_add_inbox",
    up(db): void {
        db.exec(`
      CREATE TABLE IF NOT EXISTS inbox (
        id TEXT PRIMARY KEY,
        agent_id TEXT NOT NULL,
        posted_at INTEGER NOT NULL,
        type TEXT NOT NULL,
        data TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_inbox_agent_order
        ON inbox(agent_id, posted_at);
    `);
    }
};
