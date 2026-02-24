import { describe, expect, it } from "vitest";

import { databaseOpen } from "../databaseOpen.js";
import { migration20260219Initial } from "./20260219_initial.js";
import { migration20260224AddSystemPrompts } from "./20260224_add_system_prompts.js";

describe("migration20260224AddSystemPrompts", () => {
    it("creates system_prompts table with expected columns", () => {
        const db = databaseOpen(":memory:");
        try {
            migration20260219Initial.up(db);
            migration20260224AddSystemPrompts.up(db);

            const columns = db.prepare("PRAGMA table_info(system_prompts)").all() as Array<{ name: string }>;
            const names = columns.map((c) => c.name);
            expect(names).toContain("id");
            expect(names).toContain("scope");
            expect(names).toContain("user_id");
            expect(names).toContain("kind");
            expect(names).toContain("condition");
            expect(names).toContain("prompt");
            expect(names).toContain("enabled");
            expect(names).toContain("created_at");
            expect(names).toContain("updated_at");
        } finally {
            db.close();
        }
    });

    it("creates indexes on scope and user_id", () => {
        const db = databaseOpen(":memory:");
        try {
            migration20260219Initial.up(db);
            migration20260224AddSystemPrompts.up(db);

            const indexes = db.prepare("PRAGMA index_list(system_prompts)").all() as Array<{ name: string }>;
            const names = indexes.map((i) => i.name);
            expect(names).toContain("idx_system_prompts_scope");
            expect(names).toContain("idx_system_prompts_user_id");
        } finally {
            db.close();
        }
    });

    it("is idempotent", () => {
        const db = databaseOpen(":memory:");
        try {
            migration20260219Initial.up(db);
            migration20260224AddSystemPrompts.up(db);
            migration20260224AddSystemPrompts.up(db);

            const columns = db.prepare("PRAGMA table_info(system_prompts)").all() as Array<{ name: string }>;
            expect(columns.length).toBeGreaterThan(0);
        } finally {
            db.close();
        }
    });
});
