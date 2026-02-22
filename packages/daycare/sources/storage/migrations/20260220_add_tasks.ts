import type { Migration } from "./migrationTypes.js";

/**
 * Creates cron and heartbeat task tables.
 * Expects: users/agents schema already exists.
 */
export const migration20260220AddTasks: Migration = {
    name: "20260220_add_tasks",
    up(db): void {
        db.exec(`
      CREATE TABLE IF NOT EXISTS tasks_cron (
        id TEXT PRIMARY KEY,
        task_uid TEXT NOT NULL UNIQUE,
        user_id TEXT,
        name TEXT NOT NULL,
        description TEXT,
        schedule TEXT NOT NULL,
        prompt TEXT NOT NULL,
        agent_id TEXT,
        enabled INTEGER NOT NULL DEFAULT 1,
        delete_after_run INTEGER NOT NULL DEFAULT 0,
        last_run_at INTEGER,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_tasks_cron_enabled ON tasks_cron(enabled);
      CREATE INDEX IF NOT EXISTS idx_tasks_cron_updated_at ON tasks_cron(updated_at);

      CREATE TABLE IF NOT EXISTS tasks_heartbeat (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        prompt TEXT NOT NULL,
        last_run_at INTEGER,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_tasks_heartbeat_updated_at ON tasks_heartbeat(updated_at);
    `);
    }
};
