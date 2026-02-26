import { describe, expect, it } from "vitest";

import { databaseOpenTest } from "../databaseOpenTest.js";
import { migration20260222AddExpose } from "./20260222_add_expose.js";

describe("migration20260222AddExpose", () => {
    it("creates expose_endpoints table", () => {
        const db = databaseOpenTest();
        try {
            migration20260222AddExpose.up(db);
            const columns = db.prepare("PRAGMA table_info(expose_endpoints)").all() as Array<{ name: string }>;
            expect(columns.map((column) => column.name)).toEqual([
                "id",
                "user_id",
                "target",
                "provider",
                "domain",
                "mode",
                "auth",
                "created_at",
                "updated_at"
            ]);
        } finally {
            db.close();
        }
    });
});
