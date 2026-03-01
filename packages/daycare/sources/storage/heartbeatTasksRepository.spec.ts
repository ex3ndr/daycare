import { describe, expect, it } from "vitest";
import type { HeartbeatTaskDbRecord } from "./databaseTypes.js";
import { HeartbeatTasksRepository } from "./heartbeatTasksRepository.js";
import { storageOpenTest } from "./storageOpenTest.js";

describe("HeartbeatTasksRepository", () => {
    it("supports create, find, update, delete, and recordRun", async () => {
        const storage = await storageOpenTest();
        try {
            const repo = new HeartbeatTasksRepository(storage.db);
            await storage.tasks.create({
                id: "task-alpha",
                userId: "user-1",
                title: "Alpha",
                description: null,
                code: "Check alpha",
                parameters: null,
                createdAt: 10,
                updatedAt: 10
            });
            await storage.tasks.create({
                id: "task-beta",
                userId: "user-1",
                title: "Beta",
                description: null,
                code: "Check beta",
                parameters: null,
                createdAt: 11,
                updatedAt: 11
            });
            const first: HeartbeatTaskDbRecord = {
                id: "alpha",
                version: 1,
                validFrom: 10,
                validTo: null,
                taskId: "task-alpha",
                userId: "user-1",
                title: "Alpha",
                parameters: null,
                lastRunAt: null,
                createdAt: 10,
                updatedAt: 10
            };
            const second: HeartbeatTaskDbRecord = {
                id: "beta",
                version: 1,
                validFrom: 11,
                validTo: null,
                taskId: "task-beta",
                userId: "user-1",
                title: "Beta",
                parameters: null,
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
                title: "Alpha Deep",
                updatedAt: 20
            });
            const updated = await repo.findById("alpha");
            expect(updated?.title).toBe("Alpha Deep");

            await repo.recordRun(30);
            const refreshed = await repo.findAll();
            expect(refreshed.every((task) => task.lastRunAt === 30)).toBe(true);

            expect(await repo.delete("beta")).toBe(true);
            expect(await repo.delete("beta")).toBe(false);
            expect(await repo.findById("beta")).toBeNull();
        } finally {
            storage.connection.close();
        }
    });

    it("returns cached task on repeated read", async () => {
        const storage = await storageOpenTest();
        try {
            const repo = new HeartbeatTasksRepository(storage.db);
            await storage.tasks.create({
                id: "task-cache-heartbeat",
                userId: "user-1",
                title: "Cache",
                description: null,
                code: "Prompt",
                parameters: null,
                createdAt: 1,
                updatedAt: 1
            });
            await repo.create({
                id: "cache-heartbeat",
                version: 1,
                validFrom: 1,
                validTo: null,
                taskId: "task-cache-heartbeat",
                userId: "user-1",
                title: "Cache",
                parameters: null,
                lastRunAt: null,
                createdAt: 1,
                updatedAt: 1
            });

            const first = await repo.findById("cache-heartbeat");
            expect(first?.id).toBe("cache-heartbeat");

            storage.connection.prepare("DELETE FROM tasks_heartbeat WHERE id = ?").run("cache-heartbeat");
            const second = await repo.findById("cache-heartbeat");
            expect(second?.id).toBe("cache-heartbeat");
        } finally {
            storage.connection.close();
        }
    });

    it("does not recreate a heartbeat trigger when delete races with recordRun", async () => {
        const storage = await storageOpenTest();
        try {
            const repo = new HeartbeatTasksRepository(storage.db);
            await storage.tasks.create({
                id: "task-race-heartbeat",
                userId: "user-1",
                title: "Race Heartbeat",
                description: null,
                code: "Prompt",
                parameters: null,
                createdAt: 1,
                updatedAt: 1
            });
            await repo.create({
                id: "race-heartbeat",
                version: 1,
                validFrom: 1,
                validTo: null,
                taskId: "task-race-heartbeat",
                userId: "user-1",
                title: "Race Heartbeat",
                parameters: null,
                lastRunAt: null,
                createdAt: 1,
                updatedAt: 1
            });

            const db = (
                repo as unknown as {
                    db: { transaction: (callback: (tx: unknown) => Promise<unknown>) => Promise<unknown> };
                }
            ).db;
            const originalTransaction = db.transaction.bind(db);

            let markPaused: (() => void) | null = null;
            const paused = new Promise<void>((resolve) => {
                markPaused = resolve;
            });
            const releaseGate = {
                run: (): void => undefined
            };
            const release = new Promise<void>((resolve) => {
                releaseGate.run = resolve;
            });

            db.transaction = async (callback: (tx: unknown) => Promise<unknown>) => {
                if (markPaused) {
                    markPaused();
                    markPaused = null;
                    await release;
                }
                return originalTransaction(callback);
            };

            const runPromise = repo.recordRun(99);
            await paused;
            const deletePromise = repo.delete("race-heartbeat");
            releaseGate.run();

            const [runResult, deleteResult] = await Promise.all([runPromise, deletePromise]);
            expect(runResult).toBeUndefined();
            expect(deleteResult).toBe(true);
            expect(await repo.findById("race-heartbeat")).toBeNull();
        } finally {
            storage.connection.close();
        }
    });
});
