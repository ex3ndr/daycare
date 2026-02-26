import { describe, expect, it } from "vitest";

import { databaseOpenTest } from "../databaseOpenTest.js";
import { migration20260220AddUsers } from "./20260220_add_users.js";
import { migration20260222AddUsertagConnections } from "./20260222_add_usertag_connections.js";

describe("migration20260222AddUsertagConnections", () => {
    it("adds usertag column and connections table", () => {
        const db = databaseOpenTest();
        try {
            migration20260220AddUsers.up(db);
            migration20260222AddUsertagConnections.up(db);

            const userColumns = db.prepare("PRAGMA table_info(users)").all() as Array<{ name: string }>;
            expect(userColumns.map((column) => column.name)).toContain("usertag");

            const connectionColumns = db.prepare("PRAGMA table_info(connections)").all() as Array<{ name: string }>;
            expect(connectionColumns.map((column) => column.name)).toEqual([
                "user_a_id",
                "user_b_id",
                "requested_a",
                "requested_b",
                "requested_a_at",
                "requested_b_at"
            ]);
        } finally {
            db.close();
        }
    });

    it("creates expected indexes", () => {
        const db = databaseOpenTest();
        try {
            migration20260220AddUsers.up(db);
            migration20260222AddUsertagConnections.up(db);

            const userIndexes = db.prepare("PRAGMA index_list(users)").all() as Array<{ name: string }>;
            expect(userIndexes.map((index) => index.name)).toContain("idx_users_usertag");

            const connectionIndexes = db.prepare("PRAGMA index_list(connections)").all() as Array<{ name: string }>;
            expect(connectionIndexes.map((index) => index.name)).toContain("idx_connections_user_b");
        } finally {
            db.close();
        }
    });

    it("is idempotent", () => {
        const db = databaseOpenTest();
        try {
            migration20260220AddUsers.up(db);
            migration20260222AddUsertagConnections.up(db);
            migration20260222AddUsertagConnections.up(db);

            const userColumns = db.prepare("PRAGMA table_info(users)").all() as Array<{ name: string }>;
            expect(userColumns.map((column) => column.name)).toContain("usertag");
        } finally {
            db.close();
        }
    });
});
