import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

import type { SessionPermissions } from "@/types";
import { getLogger } from "../../log.js";
import { Processes } from "./processes.js";

const TEST_TIMEOUT_MS = 30_000;

describe("Processes", () => {
  let baseDir: string;
  let workspaceDir: string;
  let permissions: SessionPermissions;
  let managers: Processes[];

  beforeEach(async () => {
    baseDir = await fs.mkdtemp(path.join(os.tmpdir(), "daycare-processes-"));
    workspaceDir = path.join(baseDir, "workspace");
    await fs.mkdir(workspaceDir, { recursive: true });
    permissions = {
      workingDir: workspaceDir,
      writeDirs: [workspaceDir],
      readDirs: [workspaceDir],
      network: false,
      events: false
    };
    managers = [];
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
    await fs.rm(baseDir, { recursive: true, force: true });
  });

  it(
    "adds allowUnixSockets when events permission is granted",
    async () => {
      const socketPath = path.join(baseDir, "engine.sock");
      const manager = await createManager(baseDir, { socketPath });
      const created = await manager.create(
        {
          command: `node -e "console.log('events-enabled')"`,
          keepAlive: false,
          cwd: workspaceDir
        },
        { ...permissions, events: true }
      );

      const settingsPath = path.join(baseDir, "processes", created.id, "sandbox.json");
      const config = JSON.parse(await fs.readFile(settingsPath, "utf8")) as {
        allowUnixSockets?: string[];
      };
      expect(config.allowUnixSockets).toEqual([socketPath]);
    },
    TEST_TIMEOUT_MS
  );

  it(
    "omits allowUnixSockets when events permission is not granted",
    async () => {
      const socketPath = path.join(baseDir, "engine.sock");
      const manager = await createManager(baseDir, { socketPath });
      const created = await manager.create(
        {
          command: `node -e "console.log('events-disabled')"`,
          keepAlive: false,
          cwd: workspaceDir
        },
        permissions
      );

      const settingsPath = path.join(baseDir, "processes", created.id, "sandbox.json");
      const config = JSON.parse(await fs.readFile(settingsPath, "utf8")) as {
        allowUnixSockets?: string[];
      };
      expect(config.allowUnixSockets).toBeUndefined();
    },
    TEST_TIMEOUT_MS
  );

  it(
    "adds allowLocalBinding when requested by process input",
    async () => {
      const manager = await createManager(baseDir);
      const created = await manager.create(
        {
          command: `node -e "console.log('local-bind-enabled')"`,
          keepAlive: false,
          cwd: workspaceDir,
          allowLocalBinding: true
        },
        { ...permissions, network: true }
      );

      const settingsPath = path.join(baseDir, "processes", created.id, "sandbox.json");
      const config = JSON.parse(await fs.readFile(settingsPath, "utf8")) as {
        network?: { allowLocalBinding?: boolean };
      };
      expect(config.network?.allowLocalBinding).toBe(true);
    },
    TEST_TIMEOUT_MS
  );

  it(
    "rehydrates running processes after manager reload",
    async () => {
      const first = await createManager(baseDir);
      const created = await first.create(
        {
          command: `node -e \"setInterval(() => {}, 1000)\"`,
          keepAlive: false,
          cwd: workspaceDir
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
        "setInterval(()=>{},1000);\""
      ].join(" ");

      const created = await manager.create(
        {
          command,
          keepAlive: true,
          cwd: workspaceDir
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
          command: `node -e \"console.log('hello-durable-log')\"`,
          keepAlive: false,
          cwd: workspaceDir
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
        "process.exit(1);\""
      ].join(" ");

      await manager.create(
        {
          command,
          keepAlive: true,
          cwd: workspaceDir
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
      const recordPath = path.join(processDir, "record.json");
      await fs.mkdir(processDir, { recursive: true });
      await fs.writeFile(
        recordPath,
        JSON.stringify(
          {
            version: 2,
            id: processId,
            name: "persisted-boot-test",
            command: `node -e "setInterval(() => {}, 1000)"`,
            cwd: workspaceDir,
            home: null,
            env: {},
            packageManagers: [],
            allowedDomains: [],
            permissions,
            keepAlive: false,
            desiredState: "running",
            status: "running",
            pid: 123_456,
            bootTimeMs: 1_000,
            restartCount: 0,
            restartFailureCount: 0,
            nextRestartAt: null,
            createdAt: now,
            updatedAt: now,
            lastStartedAt: now,
            lastExitedAt: null,
            settingsPath: path.join(processDir, "sandbox.json"),
            logPath: path.join(processDir, "process.log")
          },
          null,
          2
        ),
        "utf8"
      );

      const manager = await createManager(baseDir, { bootTimeMs: 2_000 });
      const listed = await manager.list();
      const item = listed.find((entry) => entry.id === processId);

      expect(item).toBeTruthy();
      expect(item?.pid).toBeNull();
      expect(item?.status).toBe("exited");

      const persisted = JSON.parse(await fs.readFile(recordPath, "utf8")) as {
        pid: number | null;
        bootTimeMs: number | null;
        status: string;
      };
      expect(persisted.pid).toBeNull();
      expect(persisted.bootTimeMs).toBe(2_000);
      expect(persisted.status).toBe("exited");
    },
    TEST_TIMEOUT_MS
  );

  it(
    "removes plugin-owned processes and keeps other owners",
    async () => {
      const manager = await createManager(baseDir);
      const ownedA1 = await manager.create(
        {
          command: `node -e \"setInterval(() => {}, 1000)\"`,
          keepAlive: true,
          cwd: workspaceDir,
          owner: { type: "plugin", id: "plugin-a" }
        },
        permissions
      );
      const ownedA2 = await manager.create(
        {
          command: `node -e \"setInterval(() => {}, 1000)\"`,
          keepAlive: true,
          cwd: workspaceDir,
          owner: { type: "plugin", id: "plugin-a" }
        },
        permissions
      );
      const ownedB = await manager.create(
        {
          command: `node -e \"setInterval(() => {}, 1000)\"`,
          keepAlive: true,
          cwd: workspaceDir,
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

      await expect(
        fs.access(path.join(baseDir, "processes", ownedA1.id, "record.json"))
      ).rejects.toThrow();
      await expect(
        fs.access(path.join(baseDir, "processes", ownedA2.id, "record.json"))
      ).rejects.toThrow();
      await expect(
        fs.access(path.join(baseDir, "processes", ownedB.id, "record.json"))
      ).resolves.toBeUndefined();
    },
    TEST_TIMEOUT_MS
  );

  async function createManager(
    dir: string,
    options: { bootTimeMs?: number | null; socketPath?: string } = {}
  ): Promise<Processes> {
    const manager = new Processes(dir, getLogger("test.processes"), {
      bootTimeProvider:
        options.bootTimeMs === undefined ? undefined : async () => options.bootTimeMs ?? null,
      socketPath: options.socketPath
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
