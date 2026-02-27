import { readFileSync } from "node:fs";
import type { StorageDatabase } from "../databaseOpen.js";
import { migrations } from "./_migrations.js";
import type { Migration } from "./migrationTypes.js";

/**
 * Applies SQL-file migrations for storage.
 * Expects: database connection is open.
 */
export async function migrationRun(db: StorageDatabase): Promise<string[]> {
    await migrationTableEnsure(db);
    const applied = await appliedMigrationNamesRead(db);
    const newlyApplied: string[] = [];

    for (const migration of migrations) {
        if (applied.has(migration.name)) {
            continue;
        }
        await migrationApply(db, migration);
        newlyApplied.push(migration.name);
    }

    return newlyApplied;
}

async function migrationTableEnsure(db: StorageDatabase): Promise<void> {
    await db.exec(`
        CREATE TABLE IF NOT EXISTS _migrations (
            name text PRIMARY KEY NOT NULL,
            applied_at bigint NOT NULL
        );
    `);
}

async function appliedMigrationNamesRead(db: StorageDatabase): Promise<Set<string>> {
    const rows = await db.prepare("SELECT name FROM _migrations ORDER BY applied_at ASC, name ASC").all<{
        name: string;
    }>();
    return new Set(rows.map((row) => row.name));
}

async function migrationApply(db: StorageDatabase, migration: Migration): Promise<void> {
    const migrationSql = readFileSync(new URL(`./${migration.fileName}`, import.meta.url), "utf8");
    await db.exec("BEGIN");
    try {
        await db.exec(migrationSql);
        await db
            .prepare("INSERT INTO _migrations (name, applied_at) VALUES (?, ?) ON CONFLICT(name) DO NOTHING")
            .run(migration.name, Date.now());
        await db.exec("COMMIT");
    } catch (error) {
        await db.exec("ROLLBACK");
        throw error;
    }
}
