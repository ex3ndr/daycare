import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { configResolve } from "../../../config/configResolve.js";
import type { Storage } from "../../../storage/storage.js";
import { storageOpenTest } from "../../../storage/storageOpenTest.js";
import { ConfigModule } from "../../config/configModule.js";
import { CronScheduler } from "./cronScheduler.js";

describe("CronScheduler", () => {
    let tempDir: string;
    let storage: Storage;
    const configModule = (workingDir: string): ConfigModule =>
        new ConfigModule(configResolve({ engine: { dataDir: workingDir } }, path.join(workingDir, "settings.json")));

    beforeEach(async () => {
        vi.useFakeTimers();
        tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "cron-scheduler-test-"));
        storage = await storageOpenTest();
    });

    afterEach(async () => {
        vi.useRealTimers();
        storage.connection.close();
        await fs.rm(tempDir, { recursive: true, force: true });
    });

    it("loads and schedules tasks from repository", async () => {
        await cronTaskInsert(storage, {
            id: "test-task",
            name: "Test Task",
            schedule: "* * * * *",
            code: "Do something"
        });

        const onTask = vi.fn();
        const scheduler = new CronScheduler({
            config: configModule(tempDir),
            repository: storage.cronTasks,
            tasksRepository: storage.tasks,
            usersRepository: storage.users,
            onTask
        });

        await scheduler.start();

        const tasks = scheduler.listTasks();
        expect(tasks.length).toBe(1);
        expect(tasks[0]?.id).toBe("test-task");

        scheduler.stop();
    });

    it("executes task when scheduled time arrives", async () => {
        const now = new Date("2024-01-15T10:30:00Z");
        vi.setSystemTime(now);

        const created = await cronTaskInsert(storage, {
            id: "exec-test",
            name: "Exec Test",
            schedule: "* * * * *",
            code: "Execute me"
        });

        const onTask = vi.fn();
        const scheduler = new CronScheduler({
            config: configModule(tempDir),
            repository: storage.cronTasks,
            tasksRepository: storage.tasks,
            usersRepository: storage.users,
            onTask
        });

        await scheduler.start();
        await vi.advanceTimersByTimeAsync(60 * 1000);

        expect(onTask).toHaveBeenCalledTimes(1);
        expect(onTask).toHaveBeenCalledWith(
            expect.objectContaining({
                triggerId: "exec-test",
                taskId: created.taskId,
                taskName: "Exec Test",
                code: "Execute me"
            }),
            expect.any(Object)
        );

        scheduler.stop();
    });

    it("executes a trigger immediately when requested out of line", async () => {
        const created = await cronTaskInsert(storage, {
            id: "manual-exec",
            name: "Manual Exec",
            schedule: "0 0 1 1 *",
            code: "Run now"
        });
        const onTask = vi.fn();
        const scheduler = new CronScheduler({
            config: configModule(tempDir),
            repository: storage.cronTasks,
            tasksRepository: storage.tasks,
            usersRepository: storage.users,
            onTask
        });

        await scheduler.start();
        await scheduler.triggerTaskNow("manual-exec");

        expect(onTask).toHaveBeenCalledTimes(1);
        expect(onTask).toHaveBeenCalledWith(
            expect.objectContaining({
                triggerId: "manual-exec",
                taskId: created.taskId,
                taskName: "Manual Exec",
                code: "Run now"
            }),
            expect.any(Object)
        );

        scheduler.stop();
    });

    it("acquires read lock only for task execution", async () => {
        vi.setSystemTime(new Date("2024-01-15T10:30:00Z"));

        await cronTaskInsert(storage, {
            id: "lock-scope-test",
            name: "Lock Scope Test",
            schedule: "* * * * *",
            code: "Run me"
        });

        const config = configModule(tempDir);
        const inReadLock = vi.spyOn(config, "inReadLock");
        const scheduler = new CronScheduler({
            config,
            repository: storage.cronTasks,
            tasksRepository: storage.tasks,
            usersRepository: storage.users,
            onTask: vi.fn()
        });

        await scheduler.start();
        await vi.advanceTimersByTimeAsync(60 * 1000);

        expect(inReadLock).toHaveBeenCalledTimes(1);
        scheduler.stop();
    });

    it("skips disabled tasks", async () => {
        await cronTaskInsert(storage, {
            id: "disabled-task",
            name: "Disabled Task",
            schedule: "* * * * *",
            code: "Should not run",
            enabled: false
        });

        const onTask = vi.fn();
        const scheduler = new CronScheduler({
            config: configModule(tempDir),
            repository: storage.cronTasks,
            tasksRepository: storage.tasks,
            usersRepository: storage.users,
            onTask
        });

        await scheduler.start();

        const tasks = scheduler.listTasks();
        expect(tasks.length).toBe(0);

        scheduler.stop();
    });

    it("reloads tasks from repository", async () => {
        const onTask = vi.fn();
        const scheduler = new CronScheduler({
            config: configModule(tempDir),
            repository: storage.cronTasks,
            tasksRepository: storage.tasks,
            usersRepository: storage.users,
            onTask
        });

        await scheduler.start();
        expect(scheduler.listTasks().length).toBe(0);

        await cronTaskInsert(storage, {
            id: "new-task",
            name: "New Task",
            schedule: "* * * * *",
            code: "New prompt"
        });

        await scheduler.reload();
        expect(scheduler.listTasks().length).toBe(1);

        scheduler.stop();
    });

    it("provides task context", async () => {
        const created = await cronTaskInsert(storage, {
            id: "context-test",
            name: "Context Test",
            schedule: "0 9 * * *",
            code: "Test prompt",
            userId: "user-1"
        });

        const onTask = vi.fn();
        const scheduler = new CronScheduler({
            config: configModule(tempDir),
            repository: storage.cronTasks,
            tasksRepository: storage.tasks,
            usersRepository: storage.users,
            onTask
        });

        await scheduler.start();

        const context = scheduler.getTaskContext("context-test");
        expect(context).not.toBeNull();
        expect(context?.triggerId).toBe("context-test");
        expect(context?.taskId).toBe(created.taskId);
        expect(context?.taskName).toBe("Context Test");
        expect(context?.userId).toBe("user-1");

        scheduler.stop();
    });

    it("handles task execution errors", async () => {
        vi.setSystemTime(new Date("2024-01-15T10:30:00Z"));

        await cronTaskInsert(storage, {
            id: "error-task",
            name: "Error Task",
            schedule: "* * * * *",
            code: "Will fail"
        });

        const onError = vi.fn();
        const scheduler = new CronScheduler({
            config: configModule(tempDir),
            repository: storage.cronTasks,
            tasksRepository: storage.tasks,
            usersRepository: storage.users,
            onTask: () => {
                throw new Error("Task failed");
            },
            onError
        });

        await scheduler.start();
        await vi.advanceTimersByTimeAsync(60 * 1000);

        expect(onError).toHaveBeenCalledWith(expect.any(Error), "error-task");

        scheduler.stop();
    });

    it("reports and rethrows out-of-line execution errors", async () => {
        await cronTaskInsert(storage, {
            id: "manual-fail",
            name: "Manual Fail",
            schedule: "0 0 1 1 *",
            code: "Will fail"
        });
        const onError = vi.fn();
        const scheduler = new CronScheduler({
            config: configModule(tempDir),
            repository: storage.cronTasks,
            tasksRepository: storage.tasks,
            usersRepository: storage.users,
            onTask: () => {
                throw new Error("Manual failure");
            },
            onError
        });

        await scheduler.start();
        await expect(scheduler.triggerTaskNow("manual-fail")).rejects.toThrow("Manual failure");
        expect(onError).toHaveBeenCalledWith(expect.any(Error), "manual-fail");

        scheduler.stop();
    });
});

async function cronTaskInsert(
    storage: Storage,
    input: {
        id: string;
        taskId?: string;
        name: string;
        schedule: string;
        timezone?: string;
        code: string;
        userId?: string;
        enabled?: boolean;
    }
) {
    const now = Date.now();
    const taskId = input.taskId ?? `task-${input.id}`;
    await storage.tasks.create({
        id: taskId,
        userId: input.userId ?? "user-1",
        title: input.name,
        description: null,
        code: input.code,
        parameters: null,
        createdAt: now,
        updatedAt: now
    });
    const task = {
        id: input.id,
        taskId,
        userId: input.userId ?? "user-1",
        name: input.name,
        description: null,
        schedule: input.schedule,
        timezone: input.timezone ?? "UTC",
        agentId: null,
        enabled: input.enabled !== false,
        deleteAfterRun: false,
        parameters: null,
        lastRunAt: null,
        createdAt: now,
        updatedAt: now
    };
    await storage.cronTasks.create(task);
    return task;
}
