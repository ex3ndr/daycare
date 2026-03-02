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
            expect(applied).toEqual(migrations.map((migration) => migration.name));

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
            await databaseMigrate(db);

            const result = await databaseSchemaMatches(db);
            expect(result.matches).toBe(true);
            expect(result.missingTables).toEqual([]);
            expect(result.unexpectedTables).toEqual([]);
            expect(result.tableIssues).toEqual([]);
        } finally {
            db.close();
        }
    });

    it("is idempotent when rerun with no pending migrations", async () => {
        const db = databaseOpenTest();
        try {
            const firstPass = await databaseMigrate(db);
            expect(firstPass).toEqual(migrations.map((migration) => migration.name));

            const secondPass = await databaseMigrate(db);
            expect(secondPass).toEqual([]);
        } finally {
            db.close();
        }
    });
});
