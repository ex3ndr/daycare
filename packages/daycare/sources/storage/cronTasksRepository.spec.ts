import { afterEach, describe, expect, it, vi } from "vitest";

import { CronTasksRepository } from "./cronTasksRepository.js";
import type { CronTaskDbRecord } from "./databaseTypes.js";
import { storageOpenTest } from "./storageOpenTest.js";

describe("CronTasksRepository", () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("supports create, find, update, and delete", async () => {
        const storage = await storageOpenTest();
        try {
            const repo = new CronTasksRepository(storage.db);
            await storage.tasks.create({
                id: "task-daily-report",
                userId: "user-1",
                title: "Daily Report",
                description: "Generate daily summary",
                code: "Summarize yesterday.",
                parameters: null,
                createdAt: 10,
                updatedAt: 10
            });
            const record: CronTaskDbRecord = {
                id: "daily-report",
                version: 1,
                validFrom: 10,
                validTo: null,
                taskId: "task-daily-report",
                userId: "user-1",
                schedule: "0 9 * * *",
                timezone: "UTC",
                agentId: null,
                enabled: true,
                deleteAfterRun: false,
                parameters: null,
                lastRunAt: null,
                createdAt: 10,
                updatedAt: 10
            };

            await repo.create(record);

            const byId = await repo.findById("daily-report");
            expect(byId).toEqual(record);

            const enabledOnly = await repo.findAll();
            expect(enabledOnly).toHaveLength(1);
            expect(enabledOnly[0]?.id).toBe("daily-report");

            await repo.update("daily-report", {
                enabled: false,
                lastRunAt: 20,
                updatedAt: 20
            });

            const updated = await repo.findById("daily-report");
            expect(updated?.enabled).toBe(false);
            expect(updated?.lastRunAt).toBe(20);

            const stillEnabled = await repo.findAll();
            expect(stillEnabled).toHaveLength(0);

            const includeDisabled = await repo.findAll({ includeDisabled: true });
            expect(includeDisabled).toHaveLength(1);
            expect(includeDisabled[0]?.enabled).toBe(false);

            expect(await repo.delete("daily-report")).toBe(true);
            expect(await repo.delete("daily-report")).toBe(false);
            expect(await repo.findById("daily-report")).toBeNull();
        } finally {
            storage.connection.close();
        }
    });

    it("returns cached task on repeated read", async () => {
        const storage = await storageOpenTest();
        try {
            const repo = new CronTasksRepository(storage.db);
            await storage.tasks.create({
                id: "task-cached-task",
                userId: "user-1",
                title: "Cached",
                description: null,
                code: "Prompt",
                parameters: null,
                createdAt: 1,
                updatedAt: 1
            });
            await repo.create({
                id: "cached-task",
                version: 1,
                validFrom: 1,
                validTo: null,
                taskId: "task-cached-task",
                userId: "user-1",
                schedule: "* * * * *",
                timezone: "UTC",
                agentId: null,
                enabled: true,
                deleteAfterRun: false,
                parameters: null,
                lastRunAt: null,
                createdAt: 1,
                updatedAt: 1
            });

            const first = await repo.findById("cached-task");
            expect(first?.id).toBe("cached-task");

            storage.connection.prepare("DELETE FROM tasks_cron WHERE id = ?").run("cached-task");
            const second = await repo.findById("cached-task");
            expect(second?.id).toBe("cached-task");
        } finally {
            storage.connection.close();
        }
    });

    it("updates run metadata in place without advancing version", async () => {
        const storage = await storageOpenTest();
        try {
            const repo = new CronTasksRepository(storage.db);
            await storage.tasks.create({
                id: "task-runtime-task",
                userId: "user-1",
                title: "Runtime",
                description: null,
                code: "Prompt",
                parameters: null,
                createdAt: 1,
                updatedAt: 1
            });
            await repo.create({
                id: "runtime-task",
                version: 1,
                validFrom: 1,
                validTo: null,
                taskId: "task-runtime-task",
                userId: "user-1",
                schedule: "* * * * *",
                timezone: "UTC",
                agentId: null,
                enabled: true,
                deleteAfterRun: false,
                parameters: null,
                lastRunAt: null,
                createdAt: 1,
                updatedAt: 1
            });

            vi.spyOn(Date, "now").mockReturnValue(20);
            await repo.update("runtime-task", {
                lastRunAt: 20,
                updatedAt: 20
            });

            const current = await repo.findById("runtime-task");
            expect(current?.version).toBe(1);
            expect(current?.lastRunAt).toBe(20);
            expect(current?.updatedAt).toBe(20);

            const rows = (await storage.connection
                .prepare("SELECT version, valid_to, last_run_at FROM tasks_cron WHERE id = ? ORDER BY version ASC")
                .all("runtime-task")) as Array<{
                version: number;
                valid_to: number | null;
                last_run_at: number | null;
            }>;
            expect(rows).toEqual([{ version: 1, valid_to: null, last_run_at: 20 }]);
        } finally {
            storage.connection.close();
        }
    });

    it("skips no-op updates without advancing version", async () => {
        const storage = await storageOpenTest();
        try {
            const repo = new CronTasksRepository(storage.db);
            await storage.tasks.create({
                id: "task-noop-task",
                userId: "user-1",
                title: "Noop",
                description: null,
                code: "Prompt",
                parameters: null,
                createdAt: 1,
                updatedAt: 1
            });
            await repo.create({
                id: "noop-task",
                version: 1,
                validFrom: 1,
                validTo: null,
                taskId: "task-noop-task",
                userId: "user-1",
                schedule: "* * * * *",
                timezone: "UTC",
                agentId: null,
                enabled: true,
                deleteAfterRun: false,
                parameters: null,
                lastRunAt: null,
                createdAt: 1,
                updatedAt: 1
            });

            await repo.update("noop-task", {});

            const current = await repo.findById("noop-task");
            expect(current?.version).toBe(1);
            expect(current?.updatedAt).toBe(1);

            const rows = (await storage.connection
                .prepare("SELECT version, valid_to FROM tasks_cron WHERE id = ? ORDER BY version ASC")
                .all("noop-task")) as Array<{ version: number; valid_to: number | null }>;
            expect(rows).toEqual([{ version: 1, valid_to: null }]);
        } finally {
            storage.connection.close();
        }
    });
});
