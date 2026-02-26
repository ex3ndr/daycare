import type { Migration } from "./migrationTypes.js";

/**
 * Drops duplicated code columns from cron/heartbeat trigger tables.
 * Expects: task source code is stored in tasks.code.
 */
export const migration20260303DropTriggerCode: Migration = {
    name: "20260303_drop_trigger_code",
    up(db): void {
        dropColumnIfExists(db, "tasks_cron", "code");
        dropColumnIfExists(db, "tasks_heartbeat", "code");
    }
};

function dropColumnIfExists(
    db: Pick<Parameters<Migration["up"]>[0], "prepare" | "exec">,
    tableName: string,
    columnName: string
): void {
    const columns = db.prepare(`PRAGMA table_info(${tableName})`).all() as Array<{ name?: unknown }>;
    const hasColumn = columns.some((column) => column.name === columnName);
    if (!hasColumn) {
        return;
    }
    db.exec(`ALTER TABLE ${tableName} DROP COLUMN ${columnName}`);
}
