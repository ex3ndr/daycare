import { databaseMigrate } from "./databaseMigrate.js";
import { databaseOpen } from "./databaseOpen.js";
import { Storage } from "./storage.js";

/**
 * Opens and migrates a SQLite database, then returns a Storage facade over it.
 * Expects: dbPath points to a writable SQLite file path or ":memory:".
 */
export function storageOpen(dbPath: string): Storage {
    const db = databaseOpen(dbPath);
    databaseMigrate(db);
    return Storage.fromDatabase(db);
}
