import { createId } from "@paralleldrive/cuid2";
import { describe, expect, it } from "vitest";

import { databaseOpenTest } from "../databaseOpenTest.js";
import { migration20260219Initial } from "./20260219_initial.js";
import { migration20260220AddTasks } from "./20260220_add_tasks.js";
import { migration20260220AddUsers } from "./20260220_add_users.js";
import { migration20260220UsersBootstrap } from "./20260220_users_bootstrap.js";
import { migration20260221BackfillCronUsers } from "./20260221_backfill_cron_users.js";

describe("migration20260221BackfillCronUsers", () => {
    it("fills missing cron user_id with owner user id", () => {
        const db = databaseOpenTest();
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
                INSERT INTO tasks_cron (
                    id,
                    task_uid,
                    user_id,
                    name,
                    schedule,
                    prompt,
                    enabled,
                    delete_after_run,
                    created_at,
                    updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `
            ).run("missing-user", createId(), null, "Missing User", "0 9 * * *", "Do task", 1, 0, 1, 1);

            db.prepare(
                `
                INSERT INTO tasks_cron (
                    id,
                    task_uid,
                    user_id,
                    name,
                    schedule,
                    prompt,
                    enabled,
                    delete_after_run,
                    created_at,
                    updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `
            ).run("empty-user", createId(), "   ", "Empty User", "0 10 * * *", "Do task", 1, 0, 1, 1);

            db.prepare(
                `
                INSERT INTO tasks_cron (
                    id,
                    task_uid,
                    user_id,
                    name,
                    schedule,
                    prompt,
                    enabled,
                    delete_after_run,
                    created_at,
                    updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `
            ).run("has-user", createId(), "user-123", "Has User", "0 11 * * *", "Do task", 1, 0, 1, 1);

            migration20260221BackfillCronUsers.up(db);

            const rows = db.prepare("SELECT id, user_id FROM tasks_cron ORDER BY id ASC").all() as Array<{
                id: string;
                user_id: string | null;
            }>;

            expect(rows).toEqual([
                { id: "empty-user", user_id: ownerUserId },
                { id: "has-user", user_id: "user-123" },
                { id: "missing-user", user_id: ownerUserId }
            ]);
        } finally {
            db.close();
        }
    });
});
