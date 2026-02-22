import type { Migration } from "./migrationTypes.js";

/**
 * Drops legacy gate columns from scheduled task tables.
 * Expects: tasks_cron and tasks_heartbeat tables already exist.
 */
export const migration20260221DropGateColumns: Migration = {
    name: "20260221_drop_gate_columns",
    up(db): void {
        dropColumnIfExists(db, "tasks_cron", "gate");
        dropColumnIfExists(db, "tasks_heartbeat", "gate");
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
