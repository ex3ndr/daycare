import { mkdirSync } from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import type { DaycareDatabaseClient } from "../schema.js";

export type StorageDatabase = DaycareDatabaseClient;

/**
 * Opens a SQLite database client and applies required connection pragmas.
 * Expects: dbPath is absolute and writable by the current process.
 */
export function databaseOpen(dbPath: string): StorageDatabase {
    if (dbPath !== ":memory:") {
        mkdirSync(path.dirname(dbPath), { recursive: true });
    }

    const db = new Database(dbPath);
    if (dbPath !== ":memory:") {
        db.pragma("journal_mode = WAL");
    }
    db.pragma("foreign_keys = ON");
    return db;
}
