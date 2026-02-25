import type { Migration } from "./migrationTypes.js";

/**
 * Adds unified tasks table and task_id foreign keys on cron/heartbeat triggers.
 * Expects: tasks_cron and tasks_heartbeat tables already exist.
 */
export const migration20260224AddTasksTable: Migration = {
    name: "20260224_add_tasks_table",
    up(db): void {
        db.exec(`
            CREATE TABLE IF NOT EXISTS tasks (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL,
                title TEXT NOT NULL,
                description TEXT,
                code TEXT NOT NULL,
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL,
                deleted_at INTEGER
            );

            CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON tasks(user_id);
            CREATE INDEX IF NOT EXISTS idx_tasks_updated_at ON tasks(updated_at);
        `);

        const cronColumns = db.prepare("PRAGMA table_info(tasks_cron)").all() as Array<{ name: string }>;
        if (!cronColumns.some((column) => column.name === "task_id")) {
            db.exec("ALTER TABLE tasks_cron ADD COLUMN task_id TEXT REFERENCES tasks(id)");
        }

        const heartbeatColumns = db.prepare("PRAGMA table_info(tasks_heartbeat)").all() as Array<{ name: string }>;
        if (!heartbeatColumns.some((column) => column.name === "task_id")) {
            db.exec("ALTER TABLE tasks_heartbeat ADD COLUMN task_id TEXT REFERENCES tasks(id)");
        }

        db.exec(`
            CREATE INDEX IF NOT EXISTS idx_tasks_cron_task_id ON tasks_cron(task_id);
            CREATE INDEX IF NOT EXISTS idx_tasks_heartbeat_task_id ON tasks_heartbeat(task_id);
        `);
    }
};
