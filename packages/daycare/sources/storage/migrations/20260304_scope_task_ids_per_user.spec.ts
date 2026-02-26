import { describe, expect, it } from "vitest";
import { databaseOpenTest } from "../databaseOpenTest.js";
import { migration20260304ScopeTaskIdsPerUser } from "./20260304_scope_task_ids_per_user.js";

describe("migration20260304ScopeTaskIdsPerUser", () => {
    it("scopes task and trigger ids by user", () => {
        const db = databaseOpenTest();
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
                    task_id TEXT NOT NULL REFERENCES tasks(id),
                    user_id TEXT,
                    title TEXT NOT NULL,
                    code TEXT NOT NULL,
                    last_run_at INTEGER,
                    created_at INTEGER NOT NULL,
                    updated_at INTEGER NOT NULL
                );
            `);
            db.prepare(
                "INSERT INTO tasks (id, user_id, title, description, code, created_at, updated_at, deleted_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
            ).run("shared", "user-a", "Shared A", null, "print('a')", 1, 1, null);
            db.prepare(
                "INSERT INTO tasks (id, user_id, title, description, code, created_at, updated_at, deleted_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
            ).run("only-a", "user-a", "Only A", null, "print('only')", 1, 1, null);
            db.prepare(
                "INSERT INTO tasks_cron (id, task_id, user_id, name, description, schedule, code, agent_id, enabled, delete_after_run, last_run_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
            ).run("cron-shared", "shared", "user-a", "Shared", null, "* * * * *", "print('a')", null, 1, 0, null, 1, 1);
            db.prepare(
                "INSERT INTO tasks_heartbeat (id, task_id, user_id, title, code, last_run_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
            ).run("heartbeat-shared", "shared", "user-a", "Shared", "print('a')", null, 1, 1);

            migration20260304ScopeTaskIdsPerUser.up(db);

            const taskColumns = db.prepare("PRAGMA table_info(tasks)").all() as Array<{ name: string; pk: number }>;
            const orderedPk = taskColumns
                .filter((column) => column.pk > 0)
                .sort((left, right) => left.pk - right.pk)
                .map((column) => column.name);
            expect(orderedPk).toEqual(["user_id", "id"]);

            expect(() =>
                db.prepare(
                    "INSERT INTO tasks (id, user_id, title, description, code, created_at, updated_at, deleted_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
                ).run("shared", "user-b", "Shared B", null, "print('b')", 2, 2, null)
            ).not.toThrow();

            expect(() =>
                db.prepare(
                    "INSERT INTO tasks_cron (id, task_id, user_id, name, description, schedule, code, agent_id, enabled, delete_after_run, last_run_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
                ).run(
                    "cron-shared-user-b",
                    "shared",
                    "user-b",
                    "Shared",
                    null,
                    "* * * * *",
                    "print('b')",
                    null,
                    1,
                    0,
                    null,
                    2,
                    2
                )
            ).not.toThrow();

            expect(() =>
                db.prepare(
                    "INSERT INTO tasks_cron (id, task_id, user_id, name, description, schedule, code, agent_id, enabled, delete_after_run, last_run_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
                ).run("cross-user-ref", "only-a", "user-b", "Invalid", null, "* * * * *", "print('x')", null, 1, 0, null, 3, 3)
            ).toThrow();

            const sharedCountRow = db
                .prepare("SELECT COUNT(1) AS count FROM tasks WHERE id = ?")
                .get("shared") as { count: number };
            expect(sharedCountRow.count).toBe(2);
        } finally {
            db.close();
        }
    });

    it("is idempotent", () => {
        const db = databaseOpenTest();
        try {
            db.exec(`
                CREATE TABLE tasks (
                    id TEXT NOT NULL,
                    user_id TEXT NOT NULL,
                    title TEXT NOT NULL,
                    description TEXT,
                    code TEXT NOT NULL,
                    created_at INTEGER NOT NULL,
                    updated_at INTEGER NOT NULL,
                    deleted_at INTEGER,
                    PRIMARY KEY (user_id, id)
                );
                CREATE TABLE tasks_cron (
                    id TEXT PRIMARY KEY,
                    task_id TEXT NOT NULL,
                    user_id TEXT NOT NULL,
                    name TEXT NOT NULL,
                    description TEXT,
                    schedule TEXT NOT NULL,
                    code TEXT NOT NULL,
                    agent_id TEXT,
                    enabled INTEGER NOT NULL DEFAULT 1,
                    delete_after_run INTEGER NOT NULL DEFAULT 0,
                    last_run_at INTEGER,
                    created_at INTEGER NOT NULL,
                    updated_at INTEGER NOT NULL,
                    FOREIGN KEY (user_id, task_id) REFERENCES tasks(user_id, id)
                );
                CREATE TABLE tasks_heartbeat (
                    id TEXT PRIMARY KEY,
                    task_id TEXT NOT NULL,
                    user_id TEXT NOT NULL,
                    title TEXT NOT NULL,
                    code TEXT NOT NULL,
                    last_run_at INTEGER,
                    created_at INTEGER NOT NULL,
                    updated_at INTEGER NOT NULL,
                    FOREIGN KEY (user_id, task_id) REFERENCES tasks(user_id, id)
                );
            `);

            expect(() => migration20260304ScopeTaskIdsPerUser.up(db)).not.toThrow();
            expect(() => migration20260304ScopeTaskIdsPerUser.up(db)).not.toThrow();
        } finally {
            db.close();
        }
    });
});
