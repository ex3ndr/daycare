import { describe, expect, it } from "vitest";
import { databaseOpenTest } from "../databaseOpenTest.js";
import { migration20260219Initial } from "./20260219_initial.js";
import { migration20260220AddTasks } from "./20260220_add_tasks.js";
import { migration20260224AddTasksTable } from "./20260224_add_tasks_table.js";
import { migration20260224RenamePromptToCode } from "./20260224_rename_prompt_to_code.js";

describe("migration20260224AddTasksTable", () => {
    it("creates tasks table and adds task_id columns to trigger tables", () => {
        const db = databaseOpenTest();
        try {
            migration20260219Initial.up(db);
            migration20260220AddTasks.up(db);
            migration20260224RenamePromptToCode.up(db);
            migration20260224AddTasksTable.up(db);

            const taskColumns = db.prepare("PRAGMA table_info(tasks)").all() as Array<{ name: string }>;
            const cronColumns = db.prepare("PRAGMA table_info(tasks_cron)").all() as Array<{ name: string }>;
            const heartbeatColumns = db.prepare("PRAGMA table_info(tasks_heartbeat)").all() as Array<{ name: string }>;

            expect(taskColumns.map((column) => column.name)).toEqual([
                "id",
                "user_id",
                "title",
                "description",
                "code",
                "created_at",
                "updated_at",
                "deleted_at"
            ]);
            expect(cronColumns.map((column) => column.name)).toContain("task_id");
            expect(heartbeatColumns.map((column) => column.name)).toContain("task_id");
        } finally {
            db.close();
        }
    });
});
