import type { Migration } from "./migrationTypes.js";

export const migration20260219Initial: Migration = {
    name: "20260219_initial",
    up(db): void {
        db.exec(`
      CREATE TABLE IF NOT EXISTS agents (
        id TEXT PRIMARY KEY,
        type TEXT NOT NULL,
        descriptor TEXT NOT NULL,
        active_session_id TEXT,
        permissions TEXT NOT NULL,
        tokens TEXT,
        stats TEXT NOT NULL DEFAULT '{}',
        lifecycle TEXT NOT NULL DEFAULT 'active',
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        agent_id TEXT NOT NULL,
        inference_session_id TEXT,
        created_at INTEGER NOT NULL,
        reset_message TEXT,
        FOREIGN KEY (agent_id) REFERENCES agents(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_sessions_agent_id ON sessions(agent_id);

      CREATE TABLE IF NOT EXISTS session_history (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL,
        type TEXT NOT NULL,
        at INTEGER NOT NULL,
        data TEXT NOT NULL,
        FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
      );

      CREATE INDEX IF NOT EXISTS idx_session_history_session ON session_history(session_id);
    `);
    }
};
