import { describe, expect, it } from "vitest";

import { databaseOpen } from "../databaseOpen.js";
import { migration20260219Initial } from "./20260219_initial.js";
import { migration20260220AddTasks } from "./20260220_add_tasks.js";
import { migration20260224AddTasksTable } from "./20260224_add_tasks_table.js";
import { migration20260224RenamePromptToCode } from "./20260224_rename_prompt_to_code.js";
import { migration20260227RequireCronTaskId } from "./20260227_require_cron_task_id.js";

describe("migration20260227RequireCronTaskId", () => {
    it("drops task_uid and enforces NOT NULL task_id", () => {
        const db = databaseOpen(":memory:");
        try {
            migration20260219Initial.up(db);
            migration20260220AddTasks.up(db);
            migration20260224RenamePromptToCode.up(db);
            migration20260224AddTasksTable.up(db);

            db.prepare(
                "INSERT INTO tasks (id, user_id, title, description, code, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
            ).run("task-a", "user-1", "Task A", null, "print('a')", 1, 1);
            db.prepare(
                `
                INSERT INTO tasks_cron (
                    id, task_uid, task_id, user_id, name, description, schedule, code, agent_id,
                    enabled, delete_after_run, last_run_at, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `
            ).run(
                "cron-a",
                "legacy-uid-a",
                "task-a",
                "user-1",
                "Cron A",
                null,
                "* * * * *",
                "print('a')",
                null,
                1,
                0,
                null,
                1,
                1
            );

            migration20260227RequireCronTaskId.up(db);

            const columns = db.prepare("PRAGMA table_info(tasks_cron)").all() as Array<{
                name: string;
                notnull: number;
            }>;
            const columnNames = columns.map((column) => column.name);
            const taskIdColumn = columns.find((column) => column.name === "task_id");
            const row = db.prepare("SELECT id, task_id, name, code FROM tasks_cron WHERE id = ?").get("cron-a") as {
                id: string;
                task_id: string;
                name: string;
                code: string;
            };

            expect(columnNames).toContain("task_id");
            expect(columnNames).not.toContain("task_uid");
            expect(taskIdColumn?.notnull).toBe(1);
            expect(row).toEqual({ id: "cron-a", task_id: "task-a", name: "Cron A", code: "print('a')" });
        } finally {
            db.close();
        }
    });

    it("fails when a trigger has no task_id", () => {
        const db = databaseOpen(":memory:");
        try {
            migration20260219Initial.up(db);
            migration20260220AddTasks.up(db);
            migration20260224RenamePromptToCode.up(db);
            migration20260224AddTasksTable.up(db);

            db.prepare(
                `
                INSERT INTO tasks_cron (
                    id, task_uid, task_id, user_id, name, description, schedule, code, agent_id,
                    enabled, delete_after_run, last_run_at, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `
            ).run(
                "cron-missing-task",
                "legacy-uid-missing",
                null,
                "user-1",
                "Cron missing task",
                null,
                "* * * * *",
                "print('x')",
                null,
                1,
                0,
                null,
                1,
                1
            );

            expect(() => migration20260227RequireCronTaskId.up(db)).toThrow(
                "Cannot require tasks_cron.task_id; trigger cron-missing-task has no task_id."
            );
        } finally {
            db.close();
        }
    });
});
