import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

import { databaseMigrate } from "./databaseMigrate.js";
import { databaseOpenTest } from "./databaseOpenTest.js";
import { databaseSchemaMatches } from "./databaseSchemaMatches.js";
import { migrations } from "./migrations/_migrations.js";

describe("databaseMigrate", () => {
    it("applies pending migrations", async () => {
        const db = databaseOpenTest();
        try {
            const applied = await databaseMigrate(db);
            expect(applied.length).toBeGreaterThan(0);

            const tables = (await db
                .prepare(
                    "SELECT table_name AS name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name ASC"
                )
                .all()) as Array<{ name?: string }>;
            expect(tables.some((entry) => entry.name === "users")).toBe(true);
        } finally {
            db.close();
        }
    });

    it("produces a schema that matches drizzle after applying all migrations", async () => {
        const db = databaseOpenTest();
        try {
            const applied = await databaseMigrate(db);
            expect(applied).toEqual(migrations.map((migration) => migration.name));

            const result = await databaseSchemaMatches(db);
            expect(result.matches).toBe(true);
            expect(result.missingTables).toEqual([]);
            expect(result.unexpectedTables).toEqual([]);
            expect(result.tableIssues).toEqual([]);
        } finally {
            db.close();
        }
    });

    it("preserves deleted tasks as closed versions when migrating away from deleted_at", async () => {
        const db = databaseOpenTest();
        try {
            await db.exec(`
                CREATE TABLE IF NOT EXISTS _migrations (
                    name text PRIMARY KEY NOT NULL,
                    applied_at bigint NOT NULL
                );
            `);

            const versioningIndex = migrations.findIndex((entry) => entry.name === "20260228_entity_versioning");
            if (versioningIndex < 0) {
                throw new Error("Versioning migration not found.");
            }

            const beforeVersioning = migrations.slice(0, versioningIndex);
            let appliedAt = 1;
            for (const migration of beforeVersioning) {
                const migrationSql = readFileSync(
                    new URL(`./migrations/${migration.fileName}`, import.meta.url),
                    "utf8"
                );
                await db.exec(migrationSql);
                await db
                    .prepare("INSERT INTO _migrations (name, applied_at) VALUES (?, ?)")
                    .run(migration.name, appliedAt);
                appliedAt += 1;
            }

            await db
                .prepare("INSERT INTO users (id, created_at, updated_at, nametag) VALUES (?, ?, ?, ?), (?, ?, ?, ?)")
                .run("user-active", 1, 1, "user-active-tag-42", "user-deleted", 1, 1, "user-deleted-tag-42");
            await db
                .prepare(
                    "INSERT INTO tasks (id, user_id, title, description, code, parameters, created_at, updated_at, deleted_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?), (?, ?, ?, ?, ?, ?, ?, ?, ?)"
                )
                .run(
                    "task-active",
                    "user-active",
                    "Active",
                    null,
                    "print('active')",
                    null,
                    10,
                    10,
                    null,
                    "task-deleted",
                    "user-deleted",
                    "Deleted",
                    null,
                    "print('deleted')",
                    null,
                    20,
                    20,
                    777
                );

            const applied = await databaseMigrate(db);
            expect(applied).toContain("20260228_entity_versioning");
            expect(applied).toContain("20260228_tasks_drop_deleted_at");

            const rows = (await db.prepare("SELECT id, version, valid_to FROM tasks ORDER BY id ASC").all()) as Array<{
                id: string;
                version: number;
                valid_to: number | null;
            }>;
            expect(rows).toEqual([
                { id: "task-active", version: 1, valid_to: null },
                { id: "task-deleted", version: 1, valid_to: 777 }
            ]);

            const deletedAtColumns = (await db
                .prepare(
                    "SELECT column_name FROM information_schema.columns WHERE table_name = 'tasks' AND column_name = 'deleted_at'"
                )
                .all()) as Array<{ column_name: string }>;
            expect(deletedAtColumns).toEqual([]);
        } finally {
            db.close();
        }
    });

    it("closes duplicate active agent paths before enforcing path uniqueness", async () => {
        const db = databaseOpenTest();
        try {
            await db.exec(`
                CREATE TABLE IF NOT EXISTS _migrations (
                    name text PRIMARY KEY NOT NULL,
                    applied_at bigint NOT NULL
                );
            `);

            const agentPathsIndex = migrations.findIndex((entry) => entry.name === "20260301_agents_unified");
            if (agentPathsIndex < 0) {
                throw new Error("Unified agents migration not found.");
            }

            const beforeAgentPaths = migrations.slice(0, agentPathsIndex);
            let appliedAt = 1;
            for (const migration of beforeAgentPaths) {
                const migrationSql = readFileSync(
                    new URL(`./migrations/${migration.fileName}`, import.meta.url),
                    "utf8"
                );
                await db.exec(migrationSql);
                await db
                    .prepare("INSERT INTO _migrations (name, applied_at) VALUES (?, ?)")
                    .run(migration.name, appliedAt);
                appliedAt += 1;
            }

            await db
                .prepare(
                    "INSERT INTO agents (id, version, valid_from, valid_to, type, descriptor, active_session_id, permissions, tokens, stats, lifecycle, created_at, updated_at, user_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?), (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
                )
                .run(
                    "system-task-1",
                    1,
                    10,
                    null,
                    "system",
                    '{"tag":"task"}',
                    null,
                    "{}",
                    null,
                    "{}",
                    "active",
                    10,
                    10,
                    "system",
                    "system-task-2",
                    1,
                    20,
                    null,
                    "system",
                    '{"tag":"task"}',
                    null,
                    "{}",
                    null,
                    "{}",
                    "active",
                    20,
                    20,
                    "system"
                );

            const applied = await databaseMigrate(db);
            expect(applied).toContain("20260301_agents_unified");

            const systemRows = (await db
                .prepare("SELECT id, path, valid_to FROM agents WHERE path = '/system/task' ORDER BY updated_at DESC")
                .all()) as Array<{ id: string; path: string; valid_to: number | null }>;
            expect(systemRows).toEqual([
                { id: "system-task-2", path: "/system/task", valid_to: null },
                { id: "system-task-1", path: "/system/task", valid_to: 10 }
            ]);

            const duplicates = (await db
                .prepare("SELECT path FROM agents WHERE valid_to IS NULL GROUP BY path HAVING COUNT(*) > 1")
                .all()) as Array<{ path: string }>;
            expect(duplicates).toEqual([]);
        } finally {
            db.close();
        }
    });
});
