import { describe, expect, it } from "vitest";

import { databaseOpenTest } from "../databaseOpenTest.js";
import { migration20260303DropTriggerCode } from "./20260303_drop_trigger_code.js";

describe("migration20260303DropTriggerCode", () => {
    it("removes code columns from trigger tables while keeping trigger metadata", () => {
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
                    updated_at INTEGER NOT NULL,
                    deleted_at INTEGER
                );

                CREATE TABLE tasks_cron (
                    id TEXT PRIMARY KEY,
                    task_id TEXT NOT NULL REFERENCES tasks(id),
                    user_id TEXT,
                    name TEXT NOT NULL,
                    description TEXT,
                    schedule TEXT NOT NULL,
                    code TEXT NOT NULL,
                    agent_id TEXT,
                    enabled INTEGER NOT NULL DEFAULT 1,
                    delete_after_run INTEGER NOT NULL DEFAULT 0,
                    last_run_at INTEGER,
                    created_at INTEGER NOT NULL,
                    updated_at INTEGER NOT NULL
                );

                CREATE TABLE tasks_heartbeat (
                    id TEXT PRIMARY KEY,
                    task_id TEXT REFERENCES tasks(id),
                    user_id TEXT NOT NULL DEFAULT '',
                    title TEXT NOT NULL,
                    code TEXT NOT NULL,
                    last_run_at INTEGER,
                    created_at INTEGER NOT NULL,
                    updated_at INTEGER NOT NULL
                );
            `);

            db.prepare(
                "INSERT INTO tasks (id, user_id, title, description, code, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
            ).run("task-1", "user-1", "Task 1", null, "print('task')", 1, 1);
            db.prepare(
                "INSERT INTO tasks_cron (id, task_id, user_id, name, description, schedule, code, agent_id, enabled, delete_after_run, last_run_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
            ).run("cron-1", "task-1", "user-1", "Cron 1", null, "* * * * *", "print('cron')", null, 1, 0, null, 1, 1);
            db.prepare(
                "INSERT INTO tasks_heartbeat (id, task_id, user_id, title, code, last_run_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
            ).run("hb-1", "task-1", "user-1", "Heartbeat 1", "print('heartbeat')", null, 1, 1);

            migration20260303DropTriggerCode.up(db);

            const cronColumns = db.prepare("PRAGMA table_info(tasks_cron)").all() as Array<{ name: string }>;
            const heartbeatColumns = db.prepare("PRAGMA table_info(tasks_heartbeat)").all() as Array<{ name: string }>;

            expect(cronColumns.map((column) => column.name)).not.toContain("code");
            expect(heartbeatColumns.map((column) => column.name)).not.toContain("code");

            const cronRow = db.prepare("SELECT id, task_id, schedule FROM tasks_cron WHERE id = ?").get("cron-1") as {
                id: string;
                task_id: string;
                schedule: string;
            };
            const heartbeatRow = db
                .prepare("SELECT id, task_id, title FROM tasks_heartbeat WHERE id = ?")
                .get("hb-1") as {
                id: string;
                task_id: string;
                title: string;
            };
            expect(cronRow).toEqual({ id: "cron-1", task_id: "task-1", schedule: "* * * * *" });
            expect(heartbeatRow).toEqual({ id: "hb-1", task_id: "task-1", title: "Heartbeat 1" });
        } finally {
            db.close();
        }
    });
});
