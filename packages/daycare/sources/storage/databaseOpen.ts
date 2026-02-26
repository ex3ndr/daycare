import { mkdirSync } from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import type { DaycareDatabaseClient } from "../schema.js";

export type StorageDatabase = DaycareDatabaseClient;
type DatabaseOpenOverride = (dbPath: string) => StorageDatabase | null;

/**
 * Opens a SQLite database client and applies required connection pragmas.
 * Expects: dbPath is absolute and writable by the current process.
 */
export function databaseOpen(dbPath: string): StorageDatabase {
    const override = (globalThis as { __daycareDatabaseOpenOverride?: DatabaseOpenOverride }).__daycareDatabaseOpenOverride;
    if (override) {
        const resolved = override(dbPath);
        if (resolved) {
            return resolved;
        }
    }

    return databaseOpenRaw(dbPath);
}

/**
 * Opens a SQLite database client directly, bypassing test overrides.
 * Expects: dbPath is absolute and writable by the current process.
 */
export function databaseOpenRaw(dbPath: string): StorageDatabase {
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
