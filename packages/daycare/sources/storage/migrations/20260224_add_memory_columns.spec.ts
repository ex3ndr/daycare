import { describe, expect, it } from "vitest";

import { databaseOpenTest } from "../databaseOpenTest.js";
import { migration20260219Initial } from "./20260219_initial.js";
import { migration20260224AddMemoryColumns } from "./20260224_add_memory_columns.js";

describe("migration20260224AddMemoryColumns", () => {
    it("adds invalidated_at and processed_until columns to sessions", () => {
        const db = databaseOpenTest(":memory:");
        try {
            migration20260219Initial.up(db);
            migration20260224AddMemoryColumns.up(db);

            const columns = db.prepare("PRAGMA table_info(sessions)").all() as Array<{ name: string }>;
            const names = columns.map((c) => c.name);
            expect(names).toContain("invalidated_at");
            expect(names).toContain("processed_until");
        } finally {
            db.close();
        }
    });

    it("creates index on invalidated_at", () => {
        const db = databaseOpenTest(":memory:");
        try {
            migration20260219Initial.up(db);
            migration20260224AddMemoryColumns.up(db);

            const indexes = db.prepare("PRAGMA index_list(sessions)").all() as Array<{ name: string }>;
            expect(indexes.map((i) => i.name)).toContain("idx_sessions_invalidated_at");
        } finally {
            db.close();
        }
    });

    it("is idempotent", () => {
        const db = databaseOpenTest(":memory:");
        try {
            migration20260219Initial.up(db);
            migration20260224AddMemoryColumns.up(db);
            migration20260224AddMemoryColumns.up(db);

            const columns = db.prepare("PRAGMA table_info(sessions)").all() as Array<{ name: string }>;
            const names = columns.map((c) => c.name);
            expect(names).toContain("invalidated_at");
            expect(names).toContain("processed_until");
        } finally {
            db.close();
        }
    });
});
