import { describe, expect, it } from "vitest";

import { databaseOpen } from "../databaseOpen.js";
import { migration20260219Initial } from "./20260219_initial.js";
import { migration20260222SessionEndedAt } from "./20260222_session_ended_at.js";
import { migration20260224AddMemoryColumns } from "./20260224_add_memory_columns.js";

describe("migration20260222SessionEndedAt", () => {
    it("adds ended_at column to sessions", () => {
        const db = databaseOpen(":memory:");
        try {
            migration20260219Initial.up(db);
            migration20260224AddMemoryColumns.up(db);
            migration20260222SessionEndedAt.up(db);

            const columns = db.prepare("PRAGMA table_info(sessions)").all() as Array<{ name: string }>;
            const names = columns.map((c) => c.name);
            expect(names).toContain("ended_at");
        } finally {
            db.close();
        }
    });

    it("is idempotent", () => {
        const db = databaseOpen(":memory:");
        try {
            migration20260219Initial.up(db);
            migration20260224AddMemoryColumns.up(db);
            migration20260222SessionEndedAt.up(db);
            migration20260222SessionEndedAt.up(db);

            const columns = db.prepare("PRAGMA table_info(sessions)").all() as Array<{ name: string }>;
            const names = columns.map((c) => c.name);
            expect(names).toContain("ended_at");
        } finally {
            db.close();
        }
    });
});
