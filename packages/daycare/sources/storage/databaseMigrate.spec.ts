import { describe, expect, it } from "vitest";

import { databaseMigrate } from "./databaseMigrate.js";
import { databaseOpenTest } from "./databaseOpenTest.js";

describe("databaseMigrate", () => {
    it("applies pending migrations", () => {
        const db = databaseOpenTest();
        try {
            const applied = databaseMigrate(db);
            expect(applied.length).toBeGreaterThan(0);

            const tables = db
                .prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name ASC")
                .all() as Array<{ name?: string }>;
            expect(tables.some((entry) => entry.name === "users")).toBe(true);
        } finally {
            db.close();
        }
    });
});
