import type { StorageDatabase } from "../databaseOpen.js";
import { migrations } from "./_migrations.js";

/**
 * Applies bootstrap migrations for storage.
 * Expects: database connection is open.
 */
export async function migrationRun(db: StorageDatabase): Promise<string[]> {
    for (const migration of migrations) {
        await migration.up(db);
    }

    return migrations.map((migration) => migration.name);
}
