import type { Migration } from "./migrationTypes.js";

/**
 * Adds soft-delete support for unified tasks via deleted_at.
 * Expects: tasks table may already exist from earlier migrations.
 */
export const migration20260228SoftDeleteTasks: Migration = {
    name: "20260228_soft_delete_tasks",
    up(db): void {
        const taskColumns = db.prepare("PRAGMA table_info(tasks)").all() as Array<{ name: string }>;
        if (taskColumns.length === 0) {
            return;
        }
        if (!taskColumns.some((column) => column.name === "deleted_at")) {
            db.exec("ALTER TABLE tasks ADD COLUMN deleted_at INTEGER");
        }
    }
};
