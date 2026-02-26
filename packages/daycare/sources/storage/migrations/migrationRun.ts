import type { StorageDatabase } from "../databaseOpen.js";
import { migrations } from "./_migrations.js";

/**
 * Applies bootstrap migrations for storage.
 * Expects: database connection is open.
 */
export function migrationRun(db: StorageDatabase): string[] {
    for (const migration of migrations) {
        migration.up(db);
    }

    return migrations.map((migration) => migration.name);
}
