import { describe, expect, it } from "vitest";

import { databaseOpen } from "../databaseOpen.js";
import { migration20260220AddTasks } from "./20260220_add_tasks.js";

describe("migration20260220AddTasks", () => {
    it("creates tasks tables with expected columns", () => {
        const db = databaseOpen(":memory:");
        try {
            migration20260220AddTasks.up(db);

            const cronColumns = db.prepare("PRAGMA table_info(tasks_cron)").all() as Array<{ name: string }>;
            const heartbeatColumns = db.prepare("PRAGMA table_info(tasks_heartbeat)").all() as Array<{ name: string }>;

            expect(cronColumns.map((column) => column.name)).toEqual([
                "id",
                "task_uid",
                "user_id",
                "name",
                "description",
                "schedule",
                "prompt",
                "agent_id",
                "enabled",
                "delete_after_run",
                "last_run_at",
                "created_at",
                "updated_at"
            ]);
            expect(heartbeatColumns.map((column) => column.name)).toEqual([
                "id",
                "title",
                "prompt",
                "last_run_at",
                "created_at",
                "updated_at"
            ]);
        } finally {
            db.close();
        }
    });
});
