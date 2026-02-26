import { describe, expect, it } from "vitest";

import { databaseMigrate } from "./databaseMigrate.js";
import { databaseOpenTest } from "./databaseOpenTest.js";

describe("databaseMigrate", () => {
    it("applies pending migrations", async () => {
        const db = databaseOpenTest();
        try {
            const applied = databaseMigrate(db);
            expect(applied.length).toBeGreaterThan(0);

            const tables = await db
                .prepare(
                    "SELECT table_name AS name FROM information_schema.tables WHERE table_schema = 'public' ORDER BY table_name ASC"
                )
                .all() as Array<{ name?: string }>;
            expect(tables.some((entry) => entry.name === "users")).toBe(true);
        } finally {
            db.close();
        }
    });
});
