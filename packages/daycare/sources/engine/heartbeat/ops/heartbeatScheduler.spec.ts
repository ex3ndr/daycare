import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Context } from "@/types";
import { configResolve } from "../../../config/configResolve.js";
import { Storage } from "../../../storage/storage.js";
import { ConfigModule } from "../../config/configModule.js";
import { HeartbeatScheduler } from "./heartbeatScheduler.js";

async function createTempScheduler() {
    const dir = await mkdtemp(path.join(os.tmpdir(), "daycare-heartbeat-"));
    const storage = Storage.open(":memory:");
    return { dir, storage };
}

describe("HeartbeatScheduler", () => {
    const temps: string[] = [];
    const storages: Storage[] = [];
    const configModule = (workingDir: string): ConfigModule =>
        new ConfigModule(configResolve({ engine: { dataDir: workingDir } }, path.join(workingDir, "settings.json")));

    afterEach(async () => {
        await Promise.all(temps.map((dir) => rm(dir, { recursive: true, force: true })));
        temps.length = 0;
        for (const storage of storages) {
            storage.close();
        }
        storages.length = 0;
    });

    it("runs all tasks in a single batch", async () => {
        const { dir, storage } = await createTempScheduler();
        temps.push(dir);
        storages.push(storage);

        const onRun = vi.fn();
        const onTaskComplete = vi.fn();
        const scheduler = new HeartbeatScheduler({
            config: configModule(dir),
            repository: storage.heartbeatTasks,
            tasksRepository: storage.tasks,
            onRun,
            onTaskComplete
        });

        const now = Date.now();
        await storage.tasks.create({
            id: "task-alpha",
            userId: "user-1",
            title: "Alpha",
            description: null,
            code: "Check alpha.",
            createdAt: now,
            updatedAt: now
        });
        await storage.tasks.create({
            id: "task-beta",
            userId: "user-1",
            title: "Beta",
            description: null,
            code: "Check beta.",
            createdAt: now,
            updatedAt: now
        });

        const taskA = await scheduler.createTask(contextBuild("user-1"), {
            taskId: "task-alpha"
        });
        const taskB = await scheduler.createTask(contextBuild("user-1"), {
            taskId: "task-beta"
        });

        const result = await scheduler.runNow();

        expect(result.ran).toBe(2);
        expect(result.taskIds.sort()).toEqual([taskA.id, taskB.id].sort());
        expect(onRun).toHaveBeenCalledTimes(1);
        const [runTasks, runAt] = onRun.mock.calls[0] as [unknown, unknown];
        expect(Array.isArray(runTasks)).toBe(true);
        expect(runAt).toBeInstanceOf(Date);
        expect(onTaskComplete).toHaveBeenCalledTimes(2);

        const refreshed = await scheduler.listTasks();
        expect(refreshed.every((task) => typeof task.lastRunAt === "number")).toBe(true);
        const [first, ...rest] = refreshed;
        expect(rest.every((task) => task.lastRunAt === first?.lastRunAt)).toBe(true);
    });

    it("filters tasks by id while keeping a single run", async () => {
        const { dir, storage } = await createTempScheduler();
        temps.push(dir);
        storages.push(storage);

        const onRun = vi.fn();
        const scheduler = new HeartbeatScheduler({
            config: configModule(dir),
            repository: storage.heartbeatTasks,
            tasksRepository: storage.tasks,
            onRun
        });

        const now = Date.now();
        await storage.tasks.create({
            id: "task-alpha",
            userId: "user-1",
            title: "Alpha",
            description: null,
            code: "Check alpha.",
            createdAt: now,
            updatedAt: now
        });
        await storage.tasks.create({
            id: "task-beta",
            userId: "user-1",
            title: "Beta",
            description: null,
            code: "Check beta.",
            createdAt: now,
            updatedAt: now
        });

        const taskA = await scheduler.createTask(contextBuild("user-1"), {
            taskId: "task-alpha"
        });
        await scheduler.createTask(contextBuild("user-1"), {
            taskId: "task-beta"
        });

        const result = await scheduler.runNow([taskA.id]);

        expect(result.ran).toBe(1);
        expect(result.taskIds).toEqual([taskA.id]);
        expect(onRun).toHaveBeenCalledTimes(1);
        const [runTasks] = onRun.mock.calls[0] as [unknown];
        expect(Array.isArray(runTasks)).toBe(true);
        expect((runTasks as { id: string }[]).map((task) => task.id)).toEqual([taskA.id]);
    });

    it("deletes tasks only for the same ctx user", async () => {
        const { dir, storage } = await createTempScheduler();
        temps.push(dir);
        storages.push(storage);

        const scheduler = new HeartbeatScheduler({
            config: configModule(dir),
            repository: storage.heartbeatTasks,
            tasksRepository: storage.tasks,
            onRun: vi.fn()
        });
        await storage.tasks.create({
            id: "task-owned",
            userId: "user-1",
            title: "Owned task",
            description: null,
            code: "Owned prompt",
            createdAt: Date.now(),
            updatedAt: Date.now()
        });

        const task = await scheduler.createTask(contextBuild("user-1"), {
            taskId: "task-owned"
        });

        await expect(scheduler.deleteTask(contextBuild("user-2"), task.id)).resolves.toBe(false);
        await expect(scheduler.deleteTask(contextBuild("user-1"), task.id)).resolves.toBe(true);
    });

    it("normalizes ctx userId when deleting tasks", async () => {
        const { dir, storage } = await createTempScheduler();
        temps.push(dir);
        storages.push(storage);

        const scheduler = new HeartbeatScheduler({
            config: configModule(dir),
            repository: storage.heartbeatTasks,
            tasksRepository: storage.tasks,
            onRun: vi.fn()
        });
        await storage.tasks.create({
            id: "task-trim",
            userId: "user-1",
            title: "Trim user id",
            description: null,
            code: "Delete using padded ctx user id",
            createdAt: Date.now(),
            updatedAt: Date.now()
        });

        const task = await scheduler.createTask(contextBuild("user-1"), {
            taskId: "task-trim"
        });

        await expect(scheduler.deleteTask(contextBuild("  user-1  "), task.id)).resolves.toBe(true);
    });
});

function contextBuild(userId: string): Context {
    return {
        agentId: "agent-1",
        userId
    };
}
