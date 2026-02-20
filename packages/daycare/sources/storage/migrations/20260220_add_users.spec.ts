import { describe, expect, it } from "vitest";

import { databaseOpen } from "../databaseOpen.js";
import { migration20260220AddUsers } from "./20260220_add_users.js";

describe("migration20260220AddUsers", () => {
    it("creates users and user_connector_keys tables with expected columns", () => {
        const db = databaseOpen(":memory:");
        try {
            migration20260220AddUsers.up(db);

            const usersColumns = db.prepare("PRAGMA table_info(users)").all() as Array<{ name: string }>;
            const connectorColumns = db.prepare("PRAGMA table_info(user_connector_keys)").all() as Array<{
                name: string;
            }>;

            expect(usersColumns.map((column) => column.name)).toEqual(["id", "is_owner", "created_at", "updated_at"]);
            expect(connectorColumns.map((column) => column.name)).toEqual(["id", "user_id", "connector_key"]);
        } finally {
            db.close();
        }
    });

    it("enforces connector_key uniqueness", () => {
        const db = databaseOpen(":memory:");
        try {
            migration20260220AddUsers.up(db);
            db.prepare("INSERT INTO users (id, is_owner, created_at, updated_at) VALUES (?, ?, ?, ?)").run(
                "user-1",
                1,
                1,
                1
            );
            db.prepare("INSERT INTO users (id, is_owner, created_at, updated_at) VALUES (?, ?, ?, ?)").run(
                "user-2",
                0,
                1,
                1
            );

            db.prepare("INSERT INTO user_connector_keys (user_id, connector_key) VALUES (?, ?)").run(
                "user-1",
                "telegram:123"
            );

            expect(() => {
                db.prepare("INSERT INTO user_connector_keys (user_id, connector_key) VALUES (?, ?)").run(
                    "user-2",
                    "telegram:123"
                );
            }).toThrow();
        } finally {
            db.close();
        }
    });

    it("allows only one owner user", () => {
        const db = databaseOpen(":memory:");
        try {
            migration20260220AddUsers.up(db);
            db.prepare("INSERT INTO users (id, is_owner, created_at, updated_at) VALUES (?, ?, ?, ?)").run(
                "owner-1",
                1,
                1,
                1
            );
            db.prepare("INSERT INTO users (id, is_owner, created_at, updated_at) VALUES (?, ?, ?, ?)").run(
                "user-2",
                0,
                1,
                1
            );

            expect(() => {
                db.prepare("INSERT INTO users (id, is_owner, created_at, updated_at) VALUES (?, ?, ?, ?)").run(
                    "owner-2",
                    1,
                    1,
                    1
                );
            }).toThrow();
        } finally {
            db.close();
        }
    });
});
