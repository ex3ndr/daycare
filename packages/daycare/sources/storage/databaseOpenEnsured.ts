import type { DatabaseSync as DatabaseSyncType } from "node:sqlite";

import { databaseOpen } from "./databaseOpen.js";
import { migrationRun } from "./migrations/migrationRun.js";

const migratedDbPaths = new Set<string>();

/**
 * Opens a database and ensures schema migrations have been applied.
 * Expects: dbPath is stable for the lifetime of a process.
 */
export function databaseOpenEnsured(dbPath: string): DatabaseSyncType {
    const db = databaseOpen(dbPath);
    if (migratedDbPaths.has(dbPath)) {
        return db;
    }
    migrationRun(db);
    migratedDbPaths.add(dbPath);
    return db;
}
