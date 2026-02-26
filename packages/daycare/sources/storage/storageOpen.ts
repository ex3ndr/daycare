import { databaseMigrate } from "./databaseMigrate.js";
import { databaseOpen } from "./databaseOpen.js";
import { Storage } from "./storage.js";

export type StorageOpenOptions = {
    dbUrl?: string | null;
    autoMigrate?: boolean;
};

/**
 * Opens storage for pglite or postgres and optionally applies migrations.
 * Expects: dbPath points to pglite path; dbUrl overrides with server postgres target.
 */
export function storageOpen(dbPath: string, options: StorageOpenOptions = {}): Storage {
    const dbTarget = options.dbUrl ? { kind: "postgres" as const, url: options.dbUrl } : dbPath;
    const db = databaseOpen(dbTarget);
    if (options.autoMigrate ?? true) {
        databaseMigrate(db);
    }
    return Storage.fromDatabase(db);
}
