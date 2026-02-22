import { describe, expect, it } from "vitest";

import { databaseOpen } from "../databaseOpen.js";
import { migration20260219Initial } from "./20260219_initial.js";
import { migration20260220AddTasks } from "./20260220_add_tasks.js";
import { migration20260220AddUsers } from "./20260220_add_users.js";
import { migration20260220UsersBootstrap } from "./20260220_users_bootstrap.js";
import { migration20260223AddHeartbeatUsers } from "./20260223_add_heartbeat_users.js";

describe("migration20260223AddHeartbeatUsers", () => {
    it("adds user_id to tasks_heartbeat and backfills owner user", () => {
        const db = databaseOpen(":memory:");
        try {
            migration20260219Initial.up(db);
            migration20260220AddUsers.up(db);
            migration20260220UsersBootstrap.up(db);
            migration20260220AddTasks.up(db);

            const owner = db.prepare("SELECT id FROM users WHERE is_owner = 1 LIMIT 1").get() as
                | { id?: string }
                | undefined;
            const ownerUserId = owner?.id ?? "";
            expect(ownerUserId).not.toBe("");

            db.prepare(
                `
                INSERT INTO tasks_heartbeat (
                    id,
                    title,
                    prompt,
                    last_run_at,
                    created_at,
                    updated_at
                ) VALUES (?, ?, ?, ?, ?, ?)
                `
            ).run("heartbeat-a", "Heartbeat A", "Do thing", null, 1, 1);

            migration20260223AddHeartbeatUsers.up(db);

            const columns = db.prepare("PRAGMA table_info(tasks_heartbeat)").all() as Array<{ name: string }>;
            expect(columns.map((column) => column.name)).toContain("user_id");

            const rows = db.prepare("SELECT id, user_id FROM tasks_heartbeat ORDER BY id ASC").all() as Array<{
                id: string;
                user_id: string;
            }>;
            expect(rows).toEqual([{ id: "heartbeat-a", user_id: ownerUserId }]);
        } finally {
            db.close();
        }
    });

    it("fails when heartbeat rows need backfill but no owner user exists", () => {
        const db = databaseOpen(":memory:");
        try {
            migration20260219Initial.up(db);
            migration20260220AddUsers.up(db);
            migration20260220AddTasks.up(db);

            db.prepare(
                `
                INSERT INTO tasks_heartbeat (
                    id,
                    title,
                    prompt,
                    last_run_at,
                    created_at,
                    updated_at
                ) VALUES (?, ?, ?, ?, ?, ?)
                `
            ).run("heartbeat-a", "Heartbeat A", "Do thing", null, 1, 1);

            expect(() => migration20260223AddHeartbeatUsers.up(db)).toThrow(
                "No owner user found for heartbeat user backfill."
            );
        } finally {
            db.close();
        }
    });
});
