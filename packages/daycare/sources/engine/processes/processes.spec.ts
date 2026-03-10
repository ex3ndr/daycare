import { execSync, spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import type { SessionPermissions } from "@/types";
import { getLogger } from "../../log.js";
import { sandboxHomeRedefine } from "../../sandbox/sandboxHomeRedefine.js";
import type { Storage } from "../../storage/storage.js";
import { storageOpenTest } from "../../storage/storageOpenTest.js";
import { Processes } from "./processes.js";

const TEST_TIMEOUT_MS = 30_000;
const itIfDockerSandbox = dockerSandboxAvailable() ? it : it.skip;

describe("Processes", () => {
    let baseDir: string;
    let workspaceDir: string;
    let permissions: SessionPermissions;
    let managers: Processes[];
    let storage: Storage;

    beforeEach(async () => {
        baseDir = await fs.mkdtemp(path.join(os.tmpdir(), "daycare-processes-"));
        baseDir = await fs.realpath(baseDir);
        workspaceDir = path.join(baseDir, "workspace");
        await fs.mkdir(workspaceDir, { recursive: true });
        permissions = {
            workingDir: workspaceDir,
            writeDirs: [workspaceDir]
        };
        managers = [];
        storage = await storageOpenTest();
    });

    afterEach(async () => {
        for (const manager of managers) {
            try {
                await manager.stopAll();
            } catch {
                // best-effort cleanup
            }
            manager.unload();
        }
        storage.connection.close();
        await fs.rm(baseDir, { recursive: true, force: true });
    });

    it(
        "starts a direct managed process and creates a log file",
        async () => {
            const manager = await createManager(baseDir);
            const created = await manager.create(
                {
                    command: `node -e "console.log('started-directly')"`,
                    keepAlive: false,
                    cwd: workspaceDir,
                    userId: "user-1"
                },
                permissions
            );

            await sleep(1_000);
            const content = await fs.readFile(created.logPath, "utf8");
            expect(content).toContain("started-directly");
        },
        TEST_TIMEOUT_MS
    );

    itIfDockerSandbox(
        "starts a managed process through sandbox runtime",
        async () => {
            const manager = await createDockerManager(baseDir);
            const created = await manager.create(
                {
                    command: `node -e "console.log('started-from-sandbox-runtime'); setInterval(() => {}, 1000)"`,
                    keepAlive: false,
                    cwd: workspaceDir,
                    userId: "user-1"
                },
                permissions
            );

            await sleep(1_500);
            const content = await fs.readFile(created.logPath, "utf8");
            const settingsRaw = await fs.readFile(path.join(baseDir, "processes", created.id, "sandbox.json"), "utf8");

            expect(content).toContain("started-from-sandbox-runtime");
            expect(JSON.parse(settingsRaw)).toMatchObject({
                backend: "sandbox",
                processUserId: expect.stringContaining(`process-${created.id}`)
            });

            const stopped = await manager.stop(created.id);
            expect(stopped.status).toBe("stopped");
        },
        TEST_TIMEOUT_MS
    );

    it(
        "applies HOME override when provided",
        async () => {
            const manager = await createManager(baseDir);
            const homeDir = path.join(workspaceDir, "custom-home");
            await fs.mkdir(homeDir, { recursive: true });
            const created = await manager.create(
                {
                    command: `node -e "console.log(process.env.HOME)"`,
                    keepAlive: false,
                    cwd: workspaceDir,
                    userId: "user-1",
                    home: homeDir
                },
                permissions
            );

            await sleep(1_000);
            const content = await fs.readFile(created.logPath, "utf8");
            expect(content).toContain(homeDir);
        },
        TEST_TIMEOUT_MS
    );

    it("assigns a dedicated process home when none is provided", async () => {
        const manager = await createManager(baseDir);
        const created = await manager.create(
            {
                command: `node -e "console.log(process.env.HOME)"`,
                keepAlive: false,
                cwd: workspaceDir,
                userId: "user-1"
            },
            permissions
        );

        await sleep(1_000);
        const content = await fs.readFile(created.logPath, "utf8");
        expect(created.home).toBe(path.join(baseDir, "processes", created.id, "home"));
        expect(content).toContain(path.join(baseDir, "processes", created.id, "home"));
    });

    it(
        "accepts allowLocalBinding without sandbox config generation",
        async () => {
            const manager = await createManager(baseDir);
            const created = await manager.create(
                {
                    command: `node -e "setTimeout(() => process.exit(0), 100)"`,
                    keepAlive: false,
                    cwd: workspaceDir,
                    userId: "user-1",
                    allowLocalBinding: true
                },
                permissions
            );

            expect(created.pid).not.toBeNull();
            await expect(fs.access(path.join(baseDir, "processes", created.id, "sandbox.json"))).rejects.toThrow();
        },
        TEST_TIMEOUT_MS
    );

    it(
        "rehydrates running processes after manager reload",
        async () => {
            const first = await createManager(baseDir);
            const created = await first.create(
                {
                    command: `node -e "setInterval(() => {}, 1000)"`,
                    keepAlive: false,
                    cwd: workspaceDir,
                    userId: "user-1"
                },
                permissions
            );

            expect(created.pid).not.toBeNull();
            first.unload();

            const second = await createManager(baseDir);
            const listed = await second.list();
            const restored = listed.find((entry) => entry.id === created.id);

            expect(restored).toBeTruthy();
            expect(restored?.status).toBe("running");
            expect(restored?.pid).toBe(created.pid);
        },
        TEST_TIMEOUT_MS
    );

    it(
        "restarts keepAlive processes when they exit",
        async () => {
            const manager = await createManager(baseDir);
            const statePath = path.join(workspaceDir, "restart-state.txt");
            const command = [
                "node -e",
                "\"const fs=require('node:fs');",
                `const p='${escapeForNodeString(statePath)}';`,
                "let n=0;",
                "try{n=Number(fs.readFileSync(p,'utf8'))||0}catch{};",
                "fs.writeFileSync(p,String(n+1));",
                "if(n===0){process.exit(1);}",
                'setInterval(()=>{},1000);"'
            ].join(" ");

            const created = await manager.create(
                {
                    command,
                    keepAlive: true,
                    cwd: workspaceDir,
                    userId: "user-1"
                },
                permissions
            );

            await sleep(5_000);
            const listed = await manager.list();
            const restarted = listed.find((entry) => entry.id === created.id);

            expect(restarted).toBeTruthy();
            expect(restarted?.status).toBe("running");
            expect(restarted?.restartCount).toBeGreaterThanOrEqual(1);
            expect(restarted?.pid).not.toBeNull();
        },
        TEST_TIMEOUT_MS
    );

    it(
        "returns log file path via process get",
        async () => {
            const manager = await createManager(baseDir);
            const created = await manager.create(
                {
                    command: `node -e "console.log('hello-durable-log')"`,
                    keepAlive: false,
                    cwd: workspaceDir,
                    userId: "user-1"
                },
                permissions
            );

            await sleep(1_500);
            const item = await manager.get(created.id);
            expect(path.isAbsolute(item.logPath)).toBe(true);
            expect(item.logPath.endsWith(path.join(created.id, "process.log"))).toBe(true);

            const content = await fs.readFile(item.logPath, "utf8");
            expect(content).toContain("hello-durable-log");
        },
        TEST_TIMEOUT_MS
    );

    it(
        "applies exponential backoff for repeatedly failing keepAlive processes",
        async () => {
            const manager = await createManager(baseDir);
            const failureCountPath = path.join(workspaceDir, "failure-count.txt");
            const command = [
                "node -e",
                "\"const fs=require('node:fs');",
                `const p='${escapeForNodeString(failureCountPath)}';`,
                "let n=0;",
                "try{n=Number(fs.readFileSync(p,'utf8'))||0}catch{};",
                "fs.writeFileSync(p,String(n+1));",
                'process.exit(1);"'
            ].join(" ");

            await manager.create(
                {
                    command,
                    keepAlive: true,
                    cwd: workspaceDir,
                    userId: "user-1"
                },
                permissions
            );

            await sleep(7_500);
            const raw = await fs.readFile(failureCountPath, "utf8");
            const launches = Number(raw.trim());

            expect(launches).toBeGreaterThanOrEqual(2);
            expect(launches).toBeLessThanOrEqual(3);
        },
        TEST_TIMEOUT_MS
    );

    it(
        "clears persisted pid when boot time changes across manager restarts",
        async () => {
            const processId = "persisted-boot-test";
            const processDir = path.join(baseDir, "processes", processId);
            const now = Date.now();
            await fs.mkdir(processDir, { recursive: true });
            await storage.processes.create({
                id: processId,
                userId: "owner",
                name: "persisted-boot-test",
                command: `node -e "setInterval(() => {}, 1000)"`,
                cwd: workspaceDir,
                home: null,
                env: {},
                allowLocalBinding: false,
                permissions,
                owner: null,
                keepAlive: false,
                desiredState: "running",
                status: "running",
                pid: 123_456,
                bootTimeMs: 1_000,
                restartCount: 0,
                restartFailureCount: 0,
                nextRestartAt: null,
                settingsPath: path.join(processDir, "sandbox.json"),
                logPath: path.join(processDir, "process.log"),
                createdAt: now,
                updatedAt: now,
                lastStartedAt: now,
                lastExitedAt: null
            });

            const manager = await createManager(baseDir, { bootTimeMs: 2_000 });
            const listed = await manager.list();
            const item = listed.find((entry) => entry.id === processId);

            expect(item).toBeTruthy();
            expect(item?.pid).toBeNull();
            expect(item?.status).toBe("exited");

            const persisted = await storage.processes.findById(processId);
            expect(persisted?.pid).toBeNull();
            expect(persisted?.bootTimeMs).toBe(2_000);
            expect(persisted?.status).toBe("exited");
        },
        TEST_TIMEOUT_MS
    );

    it(
        "removes plugin-owned processes and keeps other owners",
        async () => {
            const manager = await createManager(baseDir);
            const ownedA1 = await manager.create(
                {
                    command: `node -e "setInterval(() => {}, 1000)"`,
                    keepAlive: true,
                    cwd: workspaceDir,
                    userId: "user-1",
                    owner: { type: "plugin", id: "plugin-a" }
                },
                permissions
            );
            const ownedA2 = await manager.create(
                {
                    command: `node -e "setInterval(() => {}, 1000)"`,
                    keepAlive: true,
                    cwd: workspaceDir,
                    userId: "user-1",
                    owner: { type: "plugin", id: "plugin-a" }
                },
                permissions
            );
            const ownedB = await manager.create(
                {
                    command: `node -e "setInterval(() => {}, 1000)"`,
                    keepAlive: true,
                    cwd: workspaceDir,
                    userId: "user-1",
                    owner: { type: "plugin", id: "plugin-b" }
                },
                permissions
            );

            const removed = await manager.removeByOwner({ type: "plugin", id: "plugin-a" });
            expect(removed).toBe(2);

            const byOwnerA = await manager.listByOwner({ type: "plugin", id: "plugin-a" });
            const byOwnerB = await manager.listByOwner({ type: "plugin", id: "plugin-b" });
            expect(byOwnerA).toHaveLength(0);
            expect(byOwnerB.map((entry) => entry.id)).toEqual([ownedB.id]);

            await expect(fs.access(path.join(baseDir, "processes", ownedA1.id))).rejects.toThrow();
            await expect(fs.access(path.join(baseDir, "processes", ownedA2.id))).rejects.toThrow();
            await expect(fs.access(path.join(baseDir, "processes", ownedB.id))).resolves.toBeUndefined();
        },
        TEST_TIMEOUT_MS
    );

    async function createManager(dir: string, options: { bootTimeMs?: number | null } = {}): Promise<Processes> {
        const manager = new Processes(dir, getLogger("test.processes"), {
            repository: storage.processes,
            bootTimeProvider: options.bootTimeMs === undefined ? undefined : async () => options.bootTimeMs ?? null,
            runtime: processRuntimeHostBuild()
        });
        managers.push(manager);
        await manager.load();
        return manager;
    }

    async function createDockerManager(dir: string): Promise<Processes> {
        const manager = new Processes(dir, getLogger("test.processes.docker"), {
            repository: storage.processes,
            docker: {
                readOnly: false,
                unconfinedSecurity: false,
                capAdd: [],
                capDrop: [],
                allowLocalNetworkingForUsers: [],
                isolatedDnsServers: ["1.1.1.1", "8.8.8.8"],
                localDnsServers: []
            }
        });
        managers.push(manager);
        await manager.load();
        return manager;
    }
});

function sleep(ms: number): Promise<void> {
    return new Promise((resolve) => {
        setTimeout(resolve, ms);
    });
}

function escapeForNodeString(value: string): string {
    return value.replaceAll("\\", "\\\\").replaceAll("'", "\\'");
}

function processRuntimeHostBuild() {
    return {
        start: async (record: {
            command: string;
            cwd: string;
            env: Record<string, string>;
            home: string | null;
            logPath: string;
        }) => {
            const baseEnv = { ...process.env, ...record.env };
            const envResult = await sandboxHomeRedefine({ env: baseEnv, home: record.home ?? undefined });
            await fs.mkdir(path.dirname(record.logPath), { recursive: true });
            const logHandle = await fs.open(record.logPath, "a");
            const child = spawn("/bin/bash", ["-lc", record.command], {
                cwd: record.cwd,
                env: envResult.env,
                detached: true,
                stdio: ["ignore", logHandle.fd, logHandle.fd]
            });

            await new Promise<void>((resolve, reject) => {
                child.once("error", reject);
                child.once("spawn", () => resolve());
            }).finally(async () => {
                await logHandle.close();
            });

            if (!child.pid) {
                throw new Error("Failed to capture process pid.");
            }

            child.unref();
            return child.pid;
        },
        isRunning: async (record: { pid: number | null }) => {
            if (record.pid === null) {
                return false;
            }
            return processIsRunning(record.pid);
        },
        stop: async (record: { pid: number | null }, signal: "SIGTERM" | "SIGINT" | "SIGHUP" | "SIGKILL") => {
            if (record.pid === null) {
                return;
            }
            killProcessTree(record.pid, signal);
            await waitForStop(record.pid, 8_000);
        },
        remove: async () => {}
    };
}

function processIsRunning(pid: number): boolean {
    try {
        process.kill(pid, 0);
        return true;
    } catch {
        return false;
    }
}

function dockerSandboxAvailable(): boolean {
    if (process.env.CI) {
        return false;
    }
    try {
        execSync("docker image inspect daycare-runtime:latest", {
            stdio: ["ignore", "ignore", "ignore"],
            timeout: 5000
        });
        return true;
    } catch {
        return false;
    }
}

function killProcessTree(pid: number, signal: "SIGTERM" | "SIGINT" | "SIGHUP" | "SIGKILL"): void {
    try {
        process.kill(-pid, signal);
        return;
    } catch (error) {
        const code = (error as NodeJS.ErrnoException).code;
        if (code !== "ESRCH" && code !== "EPERM") {
            throw error;
        }
    }

    try {
        process.kill(pid, signal);
    } catch (error) {
        const code = (error as NodeJS.ErrnoException).code;
        if (code !== "ESRCH") {
            throw error;
        }
    }
}

async function waitForStop(pid: number, timeoutMs: number): Promise<void> {
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
        if (!processIsRunning(pid)) {
            return;
        }
        await sleep(200);
    }
    if (processIsRunning(pid)) {
        killProcessTree(pid, "SIGKILL");
    }
}
