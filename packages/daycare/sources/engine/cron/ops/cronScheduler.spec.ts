import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { createId } from "@paralleldrive/cuid2";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SessionPermissions } from "@/types";
import { configResolve } from "../../../config/configResolve.js";
import { Storage } from "../../../storage/storage.js";
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
        storage = Storage.open(":memory:");
    });

    afterEach(async () => {
        vi.useRealTimers();
        storage.close();
        await fs.rm(tempDir, { recursive: true, force: true });
    });

    it("loads and schedules tasks from repository", async () => {
        await cronTaskInsert(storage, {
            id: "test-task",
            name: "Test Task",
            schedule: "* * * * *",
            prompt: "Do something"
        });

        const onTask = vi.fn();
        const scheduler = new CronScheduler({
            config: configModule(tempDir),
            repository: storage.cronTasks,
            onTask,
            resolveDefaultPermissions: () => defaultPermissions(tempDir)
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
            prompt: "Execute me"
        });

        const onTask = vi.fn();
        const scheduler = new CronScheduler({
            config: configModule(tempDir),
            repository: storage.cronTasks,
            onTask,
            resolveDefaultPermissions: () => defaultPermissions(tempDir)
        });

        await scheduler.start();
        await vi.advanceTimersByTimeAsync(60 * 1000);

        expect(onTask).toHaveBeenCalledTimes(1);
        expect(onTask).toHaveBeenCalledWith(
            expect.objectContaining({
                taskId: "exec-test",
                taskUid: created.taskUid,
                taskName: "Exec Test",
                prompt: "Execute me"
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
            prompt: "Run me"
        });

        const config = configModule(tempDir);
        const inReadLock = vi.spyOn(config, "inReadLock");
        const scheduler = new CronScheduler({
            config,
            repository: storage.cronTasks,
            onTask: vi.fn(),
            resolveDefaultPermissions: () => defaultPermissions(tempDir)
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
            prompt: "Should not run",
            enabled: false
        });

        const onTask = vi.fn();
        const scheduler = new CronScheduler({
            config: configModule(tempDir),
            repository: storage.cronTasks,
            onTask,
            resolveDefaultPermissions: () => defaultPermissions(tempDir)
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
            onTask,
            resolveDefaultPermissions: () => defaultPermissions(tempDir)
        });

        await scheduler.start();
        expect(scheduler.listTasks().length).toBe(0);

        await cronTaskInsert(storage, {
            id: "new-task",
            name: "New Task",
            schedule: "* * * * *",
            prompt: "New prompt"
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
            prompt: "Test prompt",
            userId: "user-1"
        });

        const onTask = vi.fn();
        const scheduler = new CronScheduler({
            config: configModule(tempDir),
            repository: storage.cronTasks,
            onTask,
            resolveDefaultPermissions: () => defaultPermissions(tempDir)
        });

        await scheduler.start();

        const context = scheduler.getTaskContext("context-test");
        expect(context).not.toBeNull();
        expect(context?.taskId).toBe("context-test");
        expect(context?.taskUid).toBe(created.taskUid);
        expect(context?.taskName).toBe("Context Test");
        expect(context?.prompt).toBe("Test prompt");
        expect(context?.userId).toBe("user-1");

        scheduler.stop();
    });

    it("handles task execution errors", async () => {
        vi.setSystemTime(new Date("2024-01-15T10:30:00Z"));

        await cronTaskInsert(storage, {
            id: "error-task",
            name: "Error Task",
            schedule: "* * * * *",
            prompt: "Will fail"
        });

        const onError = vi.fn();
        const scheduler = new CronScheduler({
            config: configModule(tempDir),
            repository: storage.cronTasks,
            onTask: () => {
                throw new Error("Task failed");
            },
            onError,
            resolveDefaultPermissions: () => defaultPermissions(tempDir)
        });

        await scheduler.start();
        await vi.advanceTimersByTimeAsync(60 * 1000);

        expect(onError).toHaveBeenCalledWith(expect.any(Error), "error-task");

        scheduler.stop();
    });

    it("skips gated tasks when gate check denies", async () => {
        vi.setSystemTime(new Date("2024-01-15T10:30:00Z"));

        await cronTaskInsert(storage, {
            id: "gate-task",
            name: "Gate Task",
            schedule: "* * * * *",
            prompt: "Should be gated",
            gate: { command: "echo gate" }
        });

        const onTask = vi.fn();
        const gateCheck = vi.fn().mockResolvedValue({
            shouldRun: false,
            exitCode: 1,
            stdout: "",
            stderr: ""
        });
        const scheduler = new CronScheduler({
            config: configModule(tempDir),
            repository: storage.cronTasks,
            onTask,
            gateCheck,
            resolveDefaultPermissions: () => defaultPermissions(tempDir)
        });

        await scheduler.start();
        await vi.advanceTimersByTimeAsync(60 * 1000);

        expect(gateCheck).toHaveBeenCalledTimes(1);
        expect(onTask).not.toHaveBeenCalled();

        scheduler.stop();
    });

    it("appends gate output to the prompt", async () => {
        vi.setSystemTime(new Date("2024-01-15T10:30:00Z"));

        await cronTaskInsert(storage, {
            id: "gate-output",
            name: "Gate Output",
            schedule: "* * * * *",
            prompt: "Base prompt",
            gate: { command: "echo gate" }
        });

        const onTask = vi.fn();
        const gateCheck = vi.fn().mockResolvedValue({
            shouldRun: true,
            exitCode: 0,
            stdout: " ok ",
            stderr: " warn "
        });
        const scheduler = new CronScheduler({
            config: configModule(tempDir),
            repository: storage.cronTasks,
            onTask,
            gateCheck,
            resolveDefaultPermissions: () => defaultPermissions(tempDir)
        });

        await scheduler.start();
        await vi.advanceTimersByTimeAsync(60 * 1000);

        expect(onTask).toHaveBeenCalledTimes(1);
        expect(onTask).toHaveBeenCalledWith(
            expect.objectContaining({
                prompt: "Base prompt\n\n[Gate output]\nok\nwarn"
            }),
            expect.any(Object)
        );

        scheduler.stop();
    });
});

function defaultPermissions(workingDir: string, overrides: Partial<SessionPermissions> = {}): SessionPermissions {
    return {
        workingDir,
        writeDirs: [],
        ...overrides
    };
}

async function cronTaskInsert(
    storage: Storage,
    input: {
        id: string;
        name: string;
        schedule: string;
        prompt: string;
        userId?: string;
        gate?: { command: string; permissions?: string[] };
        enabled?: boolean;
    }
) {
    const now = Date.now();
    const task = {
        id: input.id,
        taskUid: createId(),
        userId: input.userId ?? "user-1",
        name: input.name,
        description: null,
        schedule: input.schedule,
        prompt: input.prompt,
        agentId: null,
        gate: input.gate ?? null,
        enabled: input.enabled !== false,
        deleteAfterRun: false,
        lastRunAt: null,
        createdAt: now,
        updatedAt: now
    };
    await storage.cronTasks.create(task);
    return task;
}
