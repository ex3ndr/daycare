import { describe, expect, it } from "vitest";

import { CronTasksRepository } from "./cronTasksRepository.js";
import type { CronTaskDbRecord } from "./databaseTypes.js";
import { storageOpenTest } from "./storageOpenTest.js";

describe("CronTasksRepository", () => {
    it("supports create, find, update, and delete", async () => {
        const storage = storageOpenTest();
        try {
            const repo = new CronTasksRepository(storage.db);
            await storage.tasks.create({
                id: "task-daily-report",
                userId: "user-1",
                title: "Daily Report",
                description: "Generate daily summary",
                code: "Summarize yesterday.",
                createdAt: 10,
                updatedAt: 10
            });
            const record: CronTaskDbRecord = {
                id: "daily-report",
                taskId: "task-daily-report",
                userId: "user-1",
                name: "Daily Report",
                description: "Generate daily summary",
                schedule: "0 9 * * *",
                agentId: null,
                enabled: true,
                deleteAfterRun: false,
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
            storage.db.close();
        }
    });

    it("returns cached task on repeated read", async () => {
        const storage = storageOpenTest();
        try {
            const repo = new CronTasksRepository(storage.db);
            await storage.tasks.create({
                id: "task-cached-task",
                userId: "user-1",
                title: "Cached",
                description: null,
                code: "Prompt",
                createdAt: 1,
                updatedAt: 1
            });
            await repo.create({
                id: "cached-task",
                taskId: "task-cached-task",
                userId: "user-1",
                name: "Cached",
                description: null,
                schedule: "* * * * *",
                agentId: null,
                enabled: true,
                deleteAfterRun: false,
                lastRunAt: null,
                createdAt: 1,
                updatedAt: 1
            });

            const first = await repo.findById("cached-task");
            expect(first?.id).toBe("cached-task");

            storage.db.prepare("DELETE FROM tasks_cron WHERE id = ?").run("cached-task");
            const second = await repo.findById("cached-task");
            expect(second?.id).toBe("cached-task");
        } finally {
            storage.db.close();
        }
    });
});
