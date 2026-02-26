import { describe, expect, it } from "vitest";

import { databaseOpenTest } from "../databaseOpenTest.js";
import { migration20260220AddUsers } from "./20260220_add_users.js";
import { migration20260222AddUsertagConnections } from "./20260222_add_usertag_connections.js";
import { migration20260225RequireUsertag } from "./20260225_require_usertag.js";

describe("migration20260225RequireUsertag", () => {
    it("backfills empty usertags and enforces required usertags in DB", () => {
        const db = databaseOpenTest(":memory:");
        try {
            migration20260220AddUsers.up(db);
            migration20260222AddUsertagConnections.up(db);

            db.prepare("INSERT INTO users (id, is_owner, created_at, updated_at) VALUES (?, ?, ?, ?)").run(
                "legacy-a",
                0,
                1,
                1
            );
            db.prepare("INSERT INTO users (id, is_owner, usertag, created_at, updated_at) VALUES (?, ?, ?, ?, ?)").run(
                "legacy-b",
                0,
                "",
                2,
                2
            );
            db.prepare("INSERT INTO users (id, is_owner, usertag, created_at, updated_at) VALUES (?, ?, ?, ?, ?)").run(
                "legacy-c",
                0,
                "steady-falcon-44",
                3,
                3
            );

            migration20260225RequireUsertag.up(db);

            const rows = db.prepare("SELECT id, usertag FROM users ORDER BY id ASC").all() as Array<{
                id: string;
                usertag: string | null;
            }>;
            for (const row of rows) {
                expect(row.usertag).not.toBeNull();
                expect((row.usertag ?? "").trim()).not.toBe("");
            }
            const legacyA = rows.find((row) => row.id === "legacy-a");
            const legacyB = rows.find((row) => row.id === "legacy-b");
            expect((legacyA?.usertag ?? "").trim()).not.toBe("");
            expect((legacyB?.usertag ?? "").trim()).not.toBe("");

            const indexes = db.prepare("PRAGMA index_list(users)").all() as Array<{ name: string }>;
            expect(indexes.map((index) => index.name)).toContain("idx_users_usertag_required");

            expect(() =>
                db
                    .prepare("INSERT INTO users (id, is_owner, created_at, updated_at) VALUES (?, ?, ?, ?)")
                    .run("no-tag", 0, 4, 4)
            ).toThrow("users.usertag is required");

            expect(() => db.prepare("UPDATE users SET usertag = NULL WHERE id = ?").run("legacy-a")).toThrow(
                "users.usertag is required"
            );
        } finally {
            db.close();
        }
    });

    it("assigns generated usertags for legacy users", () => {
        const db = databaseOpenTest(":memory:");
        try {
            migration20260220AddUsers.up(db);
            migration20260222AddUsertagConnections.up(db);

            db.prepare("INSERT INTO users (id, is_owner, usertag, created_at, updated_at) VALUES (?, ?, ?, ?, ?)").run(
                "owner",
                1,
                "ownerseed123",
                1,
                1
            );
            db.prepare("INSERT INTO users (id, is_owner, created_at, updated_at) VALUES (?, ?, ?, ?)").run(
                "alpha",
                0,
                2,
                2
            );

            migration20260225RequireUsertag.up(db);

            const alpha = db.prepare("SELECT usertag FROM users WHERE id = ? LIMIT 1").get("alpha") as
                | { usertag: string }
                | undefined;
            expect(alpha?.usertag).toBeTruthy();
            expect((alpha?.usertag ?? "").trim()).not.toBe("");
            expect(alpha?.usertag).not.toBe("ownerseed123");
        } finally {
            db.close();
        }
    });

    it("is idempotent", () => {
        const db = databaseOpenTest(":memory:");
        try {
            migration20260220AddUsers.up(db);
            migration20260222AddUsertagConnections.up(db);
            db.prepare("INSERT INTO users (id, is_owner, created_at, updated_at) VALUES (?, ?, ?, ?)").run(
                "legacy-a",
                0,
                1,
                1
            );

            migration20260225RequireUsertag.up(db);
            const before = db.prepare("SELECT id, usertag FROM users ORDER BY id ASC").all() as Array<{
                id: string;
                usertag: string;
            }>;
            migration20260225RequireUsertag.up(db);
            const after = db.prepare("SELECT id, usertag FROM users ORDER BY id ASC").all() as Array<{
                id: string;
                usertag: string;
            }>;

            expect(after).toEqual(before);
        } finally {
            db.close();
        }
    });
});
