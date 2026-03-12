import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { databaseOpenTest } from "../databaseOpenTest.js";
import { migrations } from "./_migrations.js";

const migrationName = "20260312191000_agent_connector_keys";

describe(migrationName, () => {
    it("does not use the single-key fallback when another version conflicts for the same user", async () => {
        const db = databaseOpenTest();
        try {
            await migrationsApplyBefore(db, migrationName);
            await db.exec(`
                INSERT INTO "users" ("id", "version", "valid_from", "valid_to", "created_at", "updated_at", "nametag")
                VALUES
                    ('user-1', 1, 0, 10, 0, 0, 'alice'),
                    ('user-1', 2, 10, NULL, 10, 10, 'alice');

                INSERT INTO "user_connector_keys" ("user_id", "connector_key")
                VALUES ('user-1', 'telegram:123');

                INSERT INTO "agents" (
                    "id",
                    "version",
                    "valid_from",
                    "valid_to",
                    "path",
                    "kind",
                    "connector_name",
                    "foreground",
                    "permissions",
                    "lifecycle",
                    "created_at",
                    "updated_at",
                    "user_id"
                )
                VALUES
                    (
                        'agent-1',
                        1,
                        0,
                        10,
                        '/user-1/telegram/123/123',
                        'connector',
                        'telegram',
                        true,
                        '{}'::jsonb,
                        'active',
                        0,
                        0,
                        'user-1'
                    ),
                    (
                        'agent-1',
                        2,
                        10,
                        NULL,
                        '/user-1/telegram/456/456',
                        'connector',
                        'telegram',
                        true,
                        '{}'::jsonb,
                        'active',
                        10,
                        10,
                        'user-1'
                    );
            `);

            await migrationApply(db, migrationName);

            const rows = (await db
                .prepare(
                    `SELECT "version", "connector_key" AS "connectorKey" FROM "agents" WHERE "id" = ? ORDER BY "version" ASC`
                )
                .all("agent-1")) as Array<{ version: number; connectorKey: string | null }>;
            expect(rows).toEqual([
                { version: 1, connectorKey: "telegram:123" },
                { version: 2, connectorKey: null }
            ]);
        } finally {
            db.close();
        }
    });

    it("uses the single-key fallback when every version is compatible with the same connector key", async () => {
        const db = databaseOpenTest();
        try {
            await migrationsApplyBefore(db, migrationName);
            await db.exec(`
                INSERT INTO "users" ("id", "version", "valid_from", "valid_to", "created_at", "updated_at", "nametag")
                VALUES
                    ('user-2', 1, 0, 10, 0, 0, 'bob'),
                    ('user-2', 2, 10, NULL, 10, 10, 'bob');

                INSERT INTO "user_connector_keys" ("user_id", "connector_key")
                VALUES ('user-2', 'telegram:123');

                INSERT INTO "agents" (
                    "id",
                    "version",
                    "valid_from",
                    "valid_to",
                    "path",
                    "kind",
                    "connector_name",
                    "foreground",
                    "permissions",
                    "lifecycle",
                    "created_at",
                    "updated_at",
                    "user_id"
                )
                VALUES
                    (
                        'agent-2',
                        1,
                        0,
                        10,
                        '/user-2/telegram',
                        'connector',
                        'telegram',
                        true,
                        '{}'::jsonb,
                        'active',
                        0,
                        0,
                        'user-2'
                    ),
                    (
                        'agent-2',
                        2,
                        10,
                        NULL,
                        '/user-2/telegram/123/123',
                        'connector',
                        'telegram',
                        true,
                        '{}'::jsonb,
                        'active',
                        10,
                        10,
                        'user-2'
                    );
            `);

            await migrationApply(db, migrationName);

            const rows = (await db
                .prepare(
                    `SELECT "version", "connector_key" AS "connectorKey" FROM "agents" WHERE "id" = ? ORDER BY "version" ASC`
                )
                .all("agent-2")) as Array<{ version: number; connectorKey: string | null }>;
            expect(rows).toEqual([
                { version: 1, connectorKey: "telegram:123" },
                { version: 2, connectorKey: "telegram:123" }
            ]);
        } finally {
            db.close();
        }
    });
});

async function migrationsApplyBefore(
    db: ReturnType<typeof databaseOpenTest>,
    targetMigrationName: string
): Promise<void> {
    const targetIndex = migrations.findIndex((migration) => migration.name === targetMigrationName);
    if (targetIndex === -1) {
        throw new Error(`Migration not found: ${targetMigrationName}`);
    }
    for (const migration of migrations.slice(0, targetIndex)) {
        await migrationSqlExec(db, migration.fileName);
    }
}

async function migrationApply(db: ReturnType<typeof databaseOpenTest>, targetMigrationName: string): Promise<void> {
    const migration = migrations.find((entry) => entry.name === targetMigrationName);
    if (!migration) {
        throw new Error(`Migration not found: ${targetMigrationName}`);
    }
    await migrationSqlExec(db, migration.fileName);
}

async function migrationSqlExec(db: ReturnType<typeof databaseOpenTest>, fileName: string): Promise<void> {
    const sql = readFileSync(new URL(`./${fileName}`, import.meta.url), "utf8");
    await db.exec(sql);
}
