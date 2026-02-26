import { describe, expect, it } from "vitest";

import { databaseOpenTest } from "../databaseOpenTest.js";
import { migration20260221AddInbox } from "./20260221_add_inbox.js";

describe("migration20260221AddInbox", () => {
    it("creates inbox table and agent ordering index", () => {
        const db = databaseOpenTest(":memory:");
        try {
            migration20260221AddInbox.up(db);

            const columns = db.prepare("PRAGMA table_info(inbox)").all() as Array<{ name: string }>;
            const indexes = db.prepare("PRAGMA index_list(inbox)").all() as Array<{ name: string }>;

            expect(columns.map((column) => column.name)).toEqual(["id", "agent_id", "posted_at", "type", "data"]);
            expect(indexes.map((index) => index.name)).toContain("idx_inbox_agent_order");
        } finally {
            db.close();
        }
    });
});
