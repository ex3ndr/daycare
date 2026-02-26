import { describe, expect, it } from "vitest";

import { databaseOpenTest } from "../databaseOpenTest.js";
import { migration20260220AddUsers } from "./20260220_add_users.js";
import { migration20260222AddUsertagConnections } from "./20260222_add_usertag_connections.js";
import { migration20260225RequireUsertag } from "./20260225_require_usertag.js";
import { migration20260226RenameUsertagToNametag } from "./20260226_rename_usertag_to_nametag.js";

describe("migration20260226RenameUsertagToNametag", () => {
    it("renames usertag column to nametag and recreates indexes/triggers", () => {
        const db = databaseOpenTest(":memory:");
        try {
            migration20260220AddUsers.up(db);
            migration20260222AddUsertagConnections.up(db);
            db.prepare("INSERT INTO users (id, is_owner, usertag, created_at, updated_at) VALUES (?, ?, ?, ?, ?)").run(
                "user-a",
                1,
                "swift-fox-42",
                1,
                1
            );
            migration20260225RequireUsertag.up(db);
            migration20260226RenameUsertagToNametag.up(db);

            // Column renamed
            const columns = db.prepare("PRAGMA table_info(users)").all() as Array<{ name: string }>;
            const columnNames = columns.map((c) => c.name);
            expect(columnNames).toContain("nametag");
            expect(columnNames).not.toContain("usertag");

            // Data preserved
            const row = db.prepare("SELECT nametag FROM users WHERE id = ?").get("user-a") as { nametag: string };
            expect(row.nametag).toBe("swift-fox-42");

            // New indexes exist
            const indexes = db.prepare("PRAGMA index_list(users)").all() as Array<{ name: string }>;
            const indexNames = indexes.map((i) => i.name);
            expect(indexNames).toContain("idx_users_nametag");
            expect(indexNames).toContain("idx_users_nametag_required");
            expect(indexNames).not.toContain("idx_users_usertag");
            expect(indexNames).not.toContain("idx_users_usertag_required");

            // Triggers enforce non-null nametag
            expect(() =>
                db
                    .prepare("INSERT INTO users (id, is_owner, created_at, updated_at) VALUES (?, ?, ?, ?)")
                    .run("no-tag", 0, 4, 4)
            ).toThrow("users.nametag is required");

            expect(() => db.prepare("UPDATE users SET nametag = NULL WHERE id = ?").run("user-a")).toThrow(
                "users.nametag is required"
            );
        } finally {
            db.close();
        }
    });

    it("is idempotent", () => {
        const db = databaseOpenTest(":memory:");
        try {
            migration20260220AddUsers.up(db);
            migration20260222AddUsertagConnections.up(db);
            db.prepare("INSERT INTO users (id, is_owner, usertag, created_at, updated_at) VALUES (?, ?, ?, ?, ?)").run(
                "user-a",
                1,
                "swift-fox-42",
                1,
                1
            );
            migration20260225RequireUsertag.up(db);

            migration20260226RenameUsertagToNametag.up(db);
            const before = db.prepare("SELECT id, nametag FROM users ORDER BY id ASC").all();

            migration20260226RenameUsertagToNametag.up(db);
            const after = db.prepare("SELECT id, nametag FROM users ORDER BY id ASC").all();

            expect(after).toEqual(before);
        } finally {
            db.close();
        }
    });
});
