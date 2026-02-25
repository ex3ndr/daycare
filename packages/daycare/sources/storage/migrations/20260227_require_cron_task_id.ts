import type { Migration } from "./migrationTypes.js";

/**
 * Removes legacy cron task_uid and enforces required task_id links.
 * Expects: tasks and tasks_cron tables already exist with task_id column.
 */
export const migration20260227RequireCronTaskId: Migration = {
    name: "20260227_require_cron_task_id",
    up(db): void {
        const columns = db.prepare("PRAGMA table_info(tasks_cron)").all() as Array<{
            name: string;
            notnull: number;
        }>;
        if (columns.length === 0) {
            return;
        }

        const hasTaskUid = columns.some((column) => column.name === "task_uid");
        const taskIdColumn = columns.find((column) => column.name === "task_id");
        const taskIdRequired = taskIdColumn?.notnull === 1;
        if (!hasTaskUid && taskIdRequired) {
            return;
        }

        const missingTaskIdRow = db
            .prepare("SELECT id FROM tasks_cron WHERE task_id IS NULL OR TRIM(task_id) = '' LIMIT 1")
            .get() as { id?: unknown } | undefined;
        if (typeof missingTaskIdRow?.id === "string" && missingTaskIdRow.id.trim()) {
            throw new Error(`Cannot require tasks_cron.task_id; trigger ${missingTaskIdRow.id} has no task_id.`);
        }

        const orphanTaskRefRow = db
            .prepare(
                `
                SELECT c.id AS id
                FROM tasks_cron c
                LEFT JOIN tasks t ON t.id = c.task_id
                WHERE t.id IS NULL
                LIMIT 1
                `
            )
            .get() as { id?: unknown } | undefined;
        if (typeof orphanTaskRefRow?.id === "string" && orphanTaskRefRow.id.trim()) {
            throw new Error(
                `Cannot require tasks_cron.task_id; trigger ${orphanTaskRefRow.id} references a missing task.`
            );
        }

        db.exec(`
            CREATE TABLE tasks_cron_next (
                id TEXT PRIMARY KEY,
                task_id TEXT NOT NULL REFERENCES tasks(id),
                user_id TEXT,
                name TEXT NOT NULL,
                description TEXT,
                schedule TEXT NOT NULL,
                code TEXT NOT NULL,
                agent_id TEXT,
                enabled INTEGER NOT NULL DEFAULT 1,
                delete_after_run INTEGER NOT NULL DEFAULT 0,
                last_run_at INTEGER,
                created_at INTEGER NOT NULL,
                updated_at INTEGER NOT NULL
            );

            INSERT INTO tasks_cron_next (
                id,
                task_id,
                user_id,
                name,
                description,
                schedule,
                code,
                agent_id,
                enabled,
                delete_after_run,
                last_run_at,
                created_at,
                updated_at
            )
            SELECT
                id,
                task_id,
                user_id,
                name,
                description,
                schedule,
                code,
                agent_id,
                enabled,
                delete_after_run,
                last_run_at,
                created_at,
                updated_at
            FROM tasks_cron;

            DROP TABLE tasks_cron;
            ALTER TABLE tasks_cron_next RENAME TO tasks_cron;

            CREATE INDEX IF NOT EXISTS idx_tasks_cron_enabled ON tasks_cron(enabled);
            CREATE INDEX IF NOT EXISTS idx_tasks_cron_updated_at ON tasks_cron(updated_at);
            CREATE INDEX IF NOT EXISTS idx_tasks_cron_task_id ON tasks_cron(task_id);
        `);
    }
};
