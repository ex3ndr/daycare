import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";

import { CronScheduler } from "./cronScheduler.js";
import { CronStore } from "./cronStore.js";
import type { SessionPermissions } from "@/types";
import { configResolve } from "../../../config/configResolve.js";
import { ConfigModule } from "../../config/configModule.js";

describe("CronScheduler", () => {
  let tempDir: string;
  let store: CronStore;
  const defaultPermissions = (workingDir: string): SessionPermissions => ({
    workingDir,
    writeDirs: [],
    readDirs: [],
    web: false
  });
  const configModule = (workingDir: string): ConfigModule =>
    new ConfigModule(
      configResolve(
        { engine: { dataDir: workingDir } },
        path.join(workingDir, "settings.json")
      )
    );

  beforeEach(async () => {
    vi.useFakeTimers();
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "cron-scheduler-test-"));
    store = new CronStore(tempDir);
  });

  afterEach(async () => {
    vi.useRealTimers();
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it("loads and schedules tasks from store", async () => {
    await store.createTask("test-task", {
      name: "Test Task",
      schedule: "* * * * *",
      prompt: "Do something"
    });

    const onTask = vi.fn();
    const scheduler = new CronScheduler({
      config: configModule(tempDir),
      store,
      onTask,
      defaultPermissions: defaultPermissions(tempDir)
    });

    await scheduler.start();

    const tasks = scheduler.listTasks();
    expect(tasks.length).toBe(1);
    expect(tasks[0]!.id).toBe("test-task");

    scheduler.stop();
  });

  it("executes task when scheduled time arrives", async () => {
    // Set current time
    const now = new Date("2024-01-15T10:30:00Z");
    vi.setSystemTime(now);

    const created = await store.createTask("exec-test", {
      name: "Exec Test",
      schedule: "* * * * *",
      prompt: "Execute me"
    });

    const onTask = vi.fn();
    const scheduler = new CronScheduler({
      config: configModule(tempDir),
      store,
      onTask,
      defaultPermissions: defaultPermissions(tempDir)
    });

    await scheduler.start();

    // Advance time to next minute
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

    await store.createTask("lock-scope-test", {
      name: "Lock Scope Test",
      schedule: "* * * * *",
      prompt: "Run me"
    });

    const config = configModule(tempDir);
    const inReadLock = vi.spyOn(config, "inReadLock");
    const scheduler = new CronScheduler({
      config,
      store,
      onTask: vi.fn(),
      defaultPermissions: defaultPermissions(tempDir)
    });

    await scheduler.start();
    await vi.advanceTimersByTimeAsync(60 * 1000);

    expect(inReadLock).toHaveBeenCalledTimes(1);
    scheduler.stop();
  });

  it("skips disabled tasks", async () => {
    await store.createTask("disabled-task", {
      name: "Disabled Task",
      schedule: "* * * * *",
      prompt: "Should not run",
      enabled: false
    });

    const onTask = vi.fn();
    const scheduler = new CronScheduler({
      config: configModule(tempDir),
      store,
      onTask,
      defaultPermissions: defaultPermissions(tempDir)
    });

    await scheduler.start();

    const tasks = scheduler.listTasks();
    expect(tasks.length).toBe(0);

    scheduler.stop();
  });

  it("reloads tasks from disk", async () => {
    const onTask = vi.fn();
    const scheduler = new CronScheduler({
      config: configModule(tempDir),
      store,
      onTask,
      defaultPermissions: defaultPermissions(tempDir)
    });

    await scheduler.start();
    expect(scheduler.listTasks().length).toBe(0);

    // Add a task to disk
    await store.createTask("new-task", {
      name: "New Task",
      schedule: "* * * * *",
      prompt: "New prompt"
    });

    await scheduler.reload();
    expect(scheduler.listTasks().length).toBe(1);

    scheduler.stop();
  });

  it("provides task context", async () => {
    const created = await store.createTask("context-test", {
      name: "Context Test",
      schedule: "0 9 * * *",
      prompt: "Test prompt"
    });

    const onTask = vi.fn();
    const scheduler = new CronScheduler({
      config: configModule(tempDir),
      store,
      onTask,
      defaultPermissions: defaultPermissions(tempDir)
    });

    await scheduler.start();

    const context = scheduler.getTaskContext("context-test");
    expect(context).not.toBeNull();
    expect(context!.taskId).toBe("context-test");
    expect(context!.taskUid).toBe(created.taskUid);
    expect(context!.taskName).toBe("Context Test");
    expect(context!.prompt).toBe("Test prompt");
    expect(context!.memoryPath).toContain("MEMORY.md");
    expect(context!.filesPath).toContain("files");

    scheduler.stop();
  });

  it("handles task execution errors", async () => {
    vi.setSystemTime(new Date("2024-01-15T10:30:00Z"));

    await store.createTask("error-task", {
      name: "Error Task",
      schedule: "* * * * *",
      prompt: "Will fail"
    });

    const onError = vi.fn();
    const scheduler = new CronScheduler({
      config: configModule(tempDir),
      store,
      onTask: () => {
        throw new Error("Task failed");
      },
      onError,
      defaultPermissions: defaultPermissions(tempDir)
    });

    await scheduler.start();
    await vi.advanceTimersByTimeAsync(60 * 1000);

    expect(onError).toHaveBeenCalledWith(
      expect.any(Error),
      "error-task"
    );

    scheduler.stop();
  });

  it("skips gated tasks when gate check denies", async () => {
    vi.setSystemTime(new Date("2024-01-15T10:30:00Z"));

    await store.createTask("gate-task", {
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
      store,
      onTask,
      gateCheck,
      defaultPermissions: defaultPermissions(tempDir)
    });

    await scheduler.start();
    await vi.advanceTimersByTimeAsync(60 * 1000);

    expect(gateCheck).toHaveBeenCalledTimes(1);
    expect(onTask).not.toHaveBeenCalled();

    scheduler.stop();
  });

  it("appends gate output to the prompt", async () => {
    vi.setSystemTime(new Date("2024-01-15T10:30:00Z"));

    await store.createTask("gate-output", {
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
      store,
      onTask,
      gateCheck,
      defaultPermissions: defaultPermissions(tempDir)
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
