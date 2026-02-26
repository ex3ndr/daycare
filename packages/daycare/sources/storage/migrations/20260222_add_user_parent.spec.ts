import { describe, expect, it } from "vitest";

import { databaseOpenTest } from "../databaseOpenTest.js";
import { migration20260220AddUsers } from "./20260220_add_users.js";
import { migration20260222AddUserParent } from "./20260222_add_user_parent.js";

describe("migration20260222AddUserParent", () => {
    it("adds parent_user_id and name columns to users", () => {
        const db = databaseOpenTest(":memory:");
        try {
            migration20260220AddUsers.up(db);
            migration20260222AddUserParent.up(db);

            const columns = db.prepare("PRAGMA table_info(users)").all() as Array<{ name: string }>;
            const names = columns.map((c) => c.name);
            expect(names).toContain("parent_user_id");
            expect(names).toContain("name");
        } finally {
            db.close();
        }
    });

    it("creates partial index on parent_user_id", () => {
        const db = databaseOpenTest(":memory:");
        try {
            migration20260220AddUsers.up(db);
            migration20260222AddUserParent.up(db);

            const indexes = db.prepare("PRAGMA index_list(users)").all() as Array<{ name: string }>;
            expect(indexes.map((i) => i.name)).toContain("idx_users_parent");
        } finally {
            db.close();
        }
    });

    it("is idempotent", () => {
        const db = databaseOpenTest(":memory:");
        try {
            migration20260220AddUsers.up(db);
            migration20260222AddUserParent.up(db);
            migration20260222AddUserParent.up(db);

            const columns = db.prepare("PRAGMA table_info(users)").all() as Array<{ name: string }>;
            const names = columns.map((c) => c.name);
            expect(names).toContain("parent_user_id");
            expect(names).toContain("name");
        } finally {
            db.close();
        }
    });
});
