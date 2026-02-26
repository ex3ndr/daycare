import { describe, expect, it } from "vitest";

import { databaseOpenTest } from "../databaseOpenTest.js";
import { migration20260224AddTasksTable } from "./20260224_add_tasks_table.js";
import { migration20260228SoftDeleteTasks } from "./20260228_soft_delete_tasks.js";

describe("migration20260228SoftDeleteTasks", () => {
    it("adds deleted_at to tasks when missing", () => {
        const db = databaseOpenTest(":memory:");
        try {
            db.exec(`
                CREATE TABLE tasks (
                    id TEXT PRIMARY KEY,
                    user_id TEXT NOT NULL,
                    title TEXT NOT NULL,
                    description TEXT,
                    code TEXT NOT NULL,
                    created_at INTEGER NOT NULL,
                    updated_at INTEGER NOT NULL
                );
            `);

            migration20260228SoftDeleteTasks.up(db);

            const columns = db.prepare("PRAGMA table_info(tasks)").all() as Array<{ name: string }>;
            expect(columns.map((column) => column.name)).toContain("deleted_at");
        } finally {
            db.close();
        }
    });

    it("is idempotent when deleted_at already exists", () => {
        const db = databaseOpenTest(":memory:");
        try {
            db.exec(`
                CREATE TABLE tasks_cron (
                    id TEXT PRIMARY KEY,
                    prompt TEXT NOT NULL
                );
                CREATE TABLE tasks_heartbeat (
                    id TEXT PRIMARY KEY,
                    prompt TEXT NOT NULL
                );
            `);
            migration20260224AddTasksTable.up(db);
            expect(() => migration20260228SoftDeleteTasks.up(db)).not.toThrow();
            expect(() => migration20260228SoftDeleteTasks.up(db)).not.toThrow();
        } finally {
            db.close();
        }
    });
});
