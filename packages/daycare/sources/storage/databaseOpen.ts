import { mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import type { DatabaseSync as DatabaseSyncType } from "node:sqlite";

const nodeRequire = createRequire(import.meta.url);
const { DatabaseSync } = nodeRequire("node:sqlite") as typeof import("node:sqlite");

/**
 * Opens a SQLite database and applies required connection pragmas.
 * Expects: dbPath is absolute and writable by the current process.
 */
export function databaseOpen(dbPath: string): DatabaseSyncType {
    if (dbPath !== ":memory:") {
        mkdirSync(path.dirname(dbPath), { recursive: true });
    }

    const db = new DatabaseSync(dbPath);
    if (dbPath !== ":memory:") {
        db.exec("PRAGMA journal_mode=WAL;");
    }
    db.exec("PRAGMA foreign_keys=ON;");
    return db;
}
