import { describe, expect, it } from "vitest";

import { CronTasksRepository } from "./cronTasksRepository.js";
import type { CronTaskDbRecord } from "./databaseTypes.js";
import { Storage } from "./storage.js";

describe("CronTasksRepository", () => {
    it("supports create, find, update, and delete", async () => {
        const storage = Storage.open(":memory:");
        try {
            const repo = new CronTasksRepository(storage.db);
            const record: CronTaskDbRecord = {
                id: "daily-report",
                taskUid: "clx9rk1p20000x5p3j7q1x8z1",
                userId: "user-1",
                name: "Daily Report",
                description: "Generate daily summary",
                schedule: "0 9 * * *",
                prompt: "Summarize yesterday.",
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
                prompt: "Summarize today.",
                lastRunAt: 20,
                updatedAt: 20
            });

            const updated = await repo.findById("daily-report");
            expect(updated?.enabled).toBe(false);
            expect(updated?.prompt).toBe("Summarize today.");
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
            storage.close();
        }
    });

    it("returns cached task on repeated read", async () => {
        const storage = Storage.open(":memory:");
        try {
            const repo = new CronTasksRepository(storage.db);
            await repo.create({
                id: "cached-task",
                taskUid: "clx9rk1p20000x5p3j7q1x8z2",
                userId: "user-1",
                name: "Cached",
                description: null,
                schedule: "* * * * *",
                prompt: "Prompt",
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
            storage.close();
        }
    });
});
