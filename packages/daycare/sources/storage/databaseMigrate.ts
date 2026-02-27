import type { StorageDatabase } from "./databaseOpen.js";
import { migrationRun } from "./migrations/migrationRun.js";

/**
 * Applies all pending storage migrations for the provided database.
 * Expects: db is open and points at the target runtime schema.
 */
export function databaseMigrate(db: StorageDatabase): Promise<string[]> {
    return migrationRun(db);
}
