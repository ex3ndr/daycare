import type { DatabaseSync } from "node:sqlite";
import type { Migration } from "./migrationTypes.js";

/**
 * Returns migrations that are not yet recorded in the _migrations table.
 * Expects: migration names are unique.
 */
export function migrationPending(db: DatabaseSync, migrations: Migration[]): Migration[] {
    const table = db
        .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = '_migrations' LIMIT 1")
        .get() as { name?: string } | undefined;
    if (!table?.name) {
        return [...migrations];
    }

    const appliedRows = db.prepare("SELECT name FROM _migrations").all() as Array<{ name: string }>;
    const applied = new Set(appliedRows.map((row) => row.name));
    return migrations.filter((migration) => !applied.has(migration.name));
}
