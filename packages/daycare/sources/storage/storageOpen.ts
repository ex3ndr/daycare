import { databaseMigrate } from "./databaseMigrate.js";
import { databaseOpen } from "./databaseOpen.js";
import { Storage } from "./storage.js";

export type StorageOpenOptions = {
    url?: string | null;
    autoMigrate?: boolean;
};

/**
 * Opens storage for pglite or postgres and optionally applies migrations.
 * Expects: path points to pglite path; url overrides with server postgres target.
 */
export function storageOpen(path: string, options: StorageOpenOptions = {}): Storage {
    const dbTarget = options.url ? { kind: "postgres" as const, url: options.url } : path;
    const db = databaseOpen(dbTarget);
    if (options.autoMigrate ?? true) {
        void databaseMigrate(db);
    }
    return Storage.fromDatabase(db);
}
