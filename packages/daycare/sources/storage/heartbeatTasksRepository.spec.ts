import { describe, expect, it } from "vitest";
import type { HeartbeatTaskDbRecord } from "./databaseTypes.js";
import { HeartbeatTasksRepository } from "./heartbeatTasksRepository.js";
import { Storage } from "./storage.js";

describe("HeartbeatTasksRepository", () => {
    it("supports create, find, update, delete, and recordRun", async () => {
        const storage = Storage.open(":memory:");
        try {
            const repo = new HeartbeatTasksRepository(storage.db);
            const first: HeartbeatTaskDbRecord = {
                id: "alpha",
                userId: "user-1",
                title: "Alpha",
                prompt: "Check alpha",
                lastRunAt: null,
                createdAt: 10,
                updatedAt: 10
            };
            const second: HeartbeatTaskDbRecord = {
                id: "beta",
                userId: "user-1",
                title: "Beta",
                prompt: "Check beta",
                lastRunAt: null,
                createdAt: 11,
                updatedAt: 11
            };

            await repo.create(first);
            await repo.create(second);

            const byId = await repo.findById("alpha");
            expect(byId).toEqual(first);

            const many = await repo.findAll();
            expect(many).toHaveLength(2);
            expect(many.map((task) => task.id).sort()).toEqual(["alpha", "beta"]);

            await repo.update("alpha", {
                prompt: "Check alpha deeply",
                updatedAt: 20
            });
            const updated = await repo.findById("alpha");
            expect(updated?.prompt).toBe("Check alpha deeply");

            await repo.recordRun(30);
            const refreshed = await repo.findAll();
            expect(refreshed.every((task) => task.lastRunAt === 30)).toBe(true);

            expect(await repo.delete("beta")).toBe(true);
            expect(await repo.delete("beta")).toBe(false);
            expect(await repo.findById("beta")).toBeNull();
        } finally {
            storage.close();
        }
    });

    it("returns cached task on repeated read", async () => {
        const storage = Storage.open(":memory:");
        try {
            const repo = new HeartbeatTasksRepository(storage.db);
            await repo.create({
                id: "cache-heartbeat",
                userId: "user-1",
                title: "Cache",
                prompt: "Prompt",
                lastRunAt: null,
                createdAt: 1,
                updatedAt: 1
            });

            const first = await repo.findById("cache-heartbeat");
            expect(first?.id).toBe("cache-heartbeat");

            storage.db.prepare("DELETE FROM tasks_heartbeat WHERE id = ?").run("cache-heartbeat");
            const second = await repo.findById("cache-heartbeat");
            expect(second?.id).toBe("cache-heartbeat");
        } finally {
            storage.close();
        }
    });
});
