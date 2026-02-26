import { describe, expect, it } from "vitest";

import { databaseMigrate } from "./databaseMigrate.js";
import { databaseOpenTest } from "./databaseOpenTest.js";
import { databaseSchemaMatches } from "./databaseSchemaMatches.js";

describe("databaseSchemaMatches", () => {
    it("returns match for a migrated database", () => {
        const db = databaseOpenTest();
        try {
            databaseMigrate(db);

            const result = databaseSchemaMatches(db);
            expect(result.matches).toBe(true);
            expect(result.missingTables).toEqual([]);
            expect(result.unexpectedTables).toEqual([]);
            expect(result.tableIssues).toEqual([]);
        } finally {
            db.close();
        }
    });

    it("reports mismatch details when schema deviates", () => {
        const db = databaseOpenTest();
        try {
            databaseMigrate(db);
            db.exec("DROP INDEX idx_users_nametag");
            db.exec("CREATE TABLE extra_table (id TEXT PRIMARY KEY)");

            const result = databaseSchemaMatches(db);
            expect(result.matches).toBe(false);
            expect(result.unexpectedTables).toContain("extra_table");

            const usersIssue = result.tableIssues.find((entry) => entry.table === "users");
            expect(usersIssue?.missingIndexes).toContain("idx_users_nametag");
        } finally {
            db.close();
        }
    });
});
