import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import { configResolve } from "../../config/configResolve.js";
import { ConfigModule } from "../config/configModule.js";
import { Crons, type CronsOptions } from "./crons.js";

const { gatePermissionRequestMock } = vi.hoisted(() => ({
    gatePermissionRequestMock: vi.fn()
}));

vi.mock("../scheduling/gatePermissionRequest.js", () => ({
    gatePermissionRequest: gatePermissionRequestMock
}));

describe("Crons", () => {
    const tempDirs: string[] = [];

    afterEach(async () => {
        await Promise.all(tempDirs.map((dir) => fs.rm(dir, { recursive: true, force: true })));
        tempDirs.length = 0;
        gatePermissionRequestMock.mockReset();
    });

    it("wires onGatePermissionRequest to gatePermissionRequest", async () => {
        const dir = await fs.mkdtemp(path.join(os.tmpdir(), "daycare-crons-facade-"));
        tempDirs.push(dir);
        gatePermissionRequestMock.mockResolvedValue({ granted: true });

        const connectorRegistry = {} as CronsOptions["connectorRegistry"];
        const permissionRequestRegistry = {} as CronsOptions["permissionRequestRegistry"];
        const agentSystemMock = {
            permissionsForTarget: vi.fn(async () => ({
                workingDir: dir,
                writeDirs: [],
                readDirs: [],
                network: false,
                events: false
            })),
            agentIdForTarget: vi.fn(async () => "cron-agent"),
            updateAgentPermissions: vi.fn(),
            postAndAwait: vi.fn(async () => ({ status: "completed" })),
            post: vi.fn(async () => undefined)
        };
        const agentSystem = agentSystemMock as unknown as CronsOptions["agentSystem"];
        const crons = new Crons({
            config: new ConfigModule(configResolve({ engine: { dataDir: dir } }, path.join(dir, "settings.json"))),
            eventBus: { emit: vi.fn() } as unknown as CronsOptions["eventBus"],
            agentSystem,
            connectorRegistry,
            permissionRequestRegistry
        });

        const callback = (
            crons as unknown as {
                scheduler: {
                    onGatePermissionRequest?: (task: unknown, missing: string[]) => Promise<boolean>;
                };
            }
        ).scheduler.onGatePermissionRequest;
        expect(callback).toBeTypeOf("function");

        const granted = await callback?.(
            {
                id: "cron-task-1",
                taskUid: "uid-1",
                name: "Nightly sync",
                prompt: "Sync now",
                schedule: "* * * * *",
                taskPath: "/tmp/task.md",
                memoryPath: "/tmp/MEMORY.md",
                filesPath: "/tmp/files"
            },
            ["@network"]
        );

        expect(granted).toBe(true);
        expect(gatePermissionRequestMock).toHaveBeenCalledWith(
            expect.objectContaining({
                missing: ["@network"],
                taskLabel: 'cron task "Nightly sync" (cron-task-1)',
                agentId: "cron-agent",
                connectorRegistry,
                permissionRequestRegistry
            })
        );
        expect(agentSystemMock.agentIdForTarget).toHaveBeenCalledWith({
            descriptor: { type: "cron", id: "uid-1", name: "Nightly sync" }
        });
    });
});
