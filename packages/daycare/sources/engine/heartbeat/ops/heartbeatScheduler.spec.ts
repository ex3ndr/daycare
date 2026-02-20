import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { SessionPermissions } from "@/types";
import { configResolve } from "../../../config/configResolve.js";
import { ConfigModule } from "../../config/configModule.js";
import { HeartbeatScheduler } from "./heartbeatScheduler.js";
import { HeartbeatStore } from "./heartbeatStore.js";

async function createTempStore() {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "daycare-heartbeat-"));
    const store = new HeartbeatStore(dir);
    await store.ensureDir();
    return { dir, store };
}

async function cleanupTempStore(dir: string) {
    await fs.rm(dir, { recursive: true, force: true });
}

describe("HeartbeatScheduler", () => {
    const temps: string[] = [];
    const configModule = (workingDir: string): ConfigModule =>
        new ConfigModule(configResolve({ engine: { dataDir: workingDir } }, path.join(workingDir, "settings.json")));

    afterEach(async () => {
        await Promise.all(temps.map((dir) => cleanupTempStore(dir)));
        temps.length = 0;
    });

    it("runs all tasks in a single batch", async () => {
        const { dir, store } = await createTempStore();
        temps.push(dir);
        const taskA = await store.createTask({ title: "Alpha", prompt: "Check alpha." });
        const taskB = await store.createTask({ title: "Beta", prompt: "Check beta." });
        const onRun = vi.fn();
        const onTaskComplete = vi.fn();

        const scheduler = new HeartbeatScheduler({
            config: configModule(dir),
            store,
            onRun,
            onTaskComplete,
            defaultPermissions: defaultPermissions(dir)
        });

        const result = await scheduler.runNow();

        expect(result.ran).toBe(2);
        expect(result.taskIds.sort()).toEqual([taskA.id, taskB.id].sort());
        expect(onRun).toHaveBeenCalledTimes(1);
        const [runTasks, runAt] = onRun.mock.calls[0] as [unknown, unknown];
        expect(Array.isArray(runTasks)).toBe(true);
        expect(runAt).toBeInstanceOf(Date);
        expect(onTaskComplete).toHaveBeenCalledTimes(2);

        const refreshed = await store.listTasks();
        expect(refreshed.every((task) => Boolean(task.lastRunAt))).toBe(true);
        const [first, ...rest] = refreshed;
        expect(rest.every((task) => task.lastRunAt === first?.lastRunAt)).toBe(true);
    });

    it("filters tasks by id while keeping a single run", async () => {
        const { dir, store } = await createTempStore();
        temps.push(dir);
        const taskA = await store.createTask({ title: "Alpha", prompt: "Check alpha." });
        await store.createTask({ title: "Beta", prompt: "Check beta." });
        const onRun = vi.fn();

        const scheduler = new HeartbeatScheduler({
            config: configModule(dir),
            store,
            onRun,
            defaultPermissions: defaultPermissions(dir)
        });

        const result = await scheduler.runNow([taskA.id]);

        expect(result.ran).toBe(1);
        expect(result.taskIds).toEqual([taskA.id]);
        expect(onRun).toHaveBeenCalledTimes(1);
        const [runTasks] = onRun.mock.calls[0] as [unknown];
        expect(Array.isArray(runTasks)).toBe(true);
        expect((runTasks as { id: string }[]).map((task) => task.id)).toEqual([taskA.id]);
    });

    it("skips gated tasks when gate check denies", async () => {
        const { dir, store } = await createTempStore();
        temps.push(dir);
        await store.createTask({
            title: "Alpha",
            prompt: "Check alpha.",
            gate: { command: "echo gate" }
        });
        await store.createTask({ title: "Beta", prompt: "Check beta." });
        const onRun = vi.fn();
        const gateCheck = vi.fn().mockResolvedValue({
            shouldRun: false,
            exitCode: 1,
            stdout: "",
            stderr: ""
        });

        const scheduler = new HeartbeatScheduler({
            config: configModule(dir),
            store,
            onRun,
            gateCheck,
            defaultPermissions: defaultPermissions(dir)
        });

        const result = await scheduler.runNow();

        expect(gateCheck).toHaveBeenCalledTimes(1);
        expect(result.ran).toBe(1);
        expect(result.taskIds).toEqual(["beta"]);
        expect(onRun).toHaveBeenCalledTimes(1);
        const [runTasks] = onRun.mock.calls[0] as [unknown];
        expect(Array.isArray(runTasks)).toBe(true);
        expect((runTasks as { id: string }[]).map((task) => task.id)).toEqual(["beta"]);
    });

    it("appends gate output to the prompt", async () => {
        const { dir, store } = await createTempStore();
        temps.push(dir);
        await store.createTask({
            title: "Alpha",
            prompt: "Base prompt",
            gate: { command: "echo gate" }
        });
        const onRun = vi.fn();
        const gateCheck = vi.fn().mockResolvedValue({
            shouldRun: true,
            exitCode: 0,
            stdout: " ok ",
            stderr: ""
        });

        const scheduler = new HeartbeatScheduler({
            config: configModule(dir),
            store,
            onRun,
            gateCheck,
            defaultPermissions: defaultPermissions(dir)
        });

        const result = await scheduler.runNow();

        expect(result.ran).toBe(1);
        const [runTasks] = onRun.mock.calls[0] as [unknown];
        expect(Array.isArray(runTasks)).toBe(true);
        const task = (runTasks as { prompt: string }[])[0];
        expect(task?.prompt).toBe("Base prompt\n\n[Gate output]\nok");
    });

    it("requests missing gate permissions and runs gate after approval", async () => {
        const { dir, store } = await createTempStore();
        temps.push(dir);
        await store.createTask({
            title: "Needs network",
            prompt: "Check network.",
            gate: { command: "echo gate", permissions: ["@network"] }
        });
        const onRun = vi.fn();
        const gateCheck = vi.fn().mockResolvedValue({
            shouldRun: true,
            exitCode: 0,
            stdout: "",
            stderr: ""
        });
        let networkGranted = false;
        const resolvePermissions = vi.fn(async () => defaultPermissions(dir, { network: networkGranted }));
        const onGatePermissionRequest = vi.fn(async () => {
            networkGranted = true;
            return true;
        });

        const scheduler = new HeartbeatScheduler({
            config: configModule(dir),
            store,
            onRun,
            gateCheck,
            resolvePermissions,
            onGatePermissionRequest,
            defaultPermissions: defaultPermissions(dir)
        });

        const result = await scheduler.runNow();

        expect(result.ran).toBe(1);
        expect(onGatePermissionRequest).toHaveBeenCalledWith(expect.objectContaining({ title: "Needs network" }), [
            "@network"
        ]);
        expect(resolvePermissions).toHaveBeenCalledTimes(2);
        expect(gateCheck).toHaveBeenCalledTimes(1);
        expect(onRun).toHaveBeenCalledTimes(1);
    });

    it("skips task when missing gate permissions are denied", async () => {
        const { dir, store } = await createTempStore();
        temps.push(dir);
        await store.createTask({
            title: "Needs network",
            prompt: "Check network.",
            gate: { command: "echo gate", permissions: ["@network"] }
        });
        const onRun = vi.fn();
        const gateCheck = vi.fn().mockResolvedValue({
            shouldRun: true,
            exitCode: 0,
            stdout: "",
            stderr: ""
        });

        const scheduler = new HeartbeatScheduler({
            config: configModule(dir),
            store,
            onRun,
            gateCheck,
            onGatePermissionRequest: vi.fn(async () => false),
            defaultPermissions: defaultPermissions(dir)
        });

        const result = await scheduler.runNow();

        expect(result.ran).toBe(0);
        expect(result.taskIds).toEqual([]);
        expect(gateCheck).not.toHaveBeenCalled();
        expect(onRun).not.toHaveBeenCalled();
    });
});

function defaultPermissions(workingDir: string, overrides: Partial<SessionPermissions> = {}): SessionPermissions {
    return {
        workingDir,
        writeDirs: [],
        readDirs: [],
        network: false,
        events: false,
        ...overrides
    };
}
