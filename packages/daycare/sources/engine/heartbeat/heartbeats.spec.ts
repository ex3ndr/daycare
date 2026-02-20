import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

import { configResolve } from "../../config/configResolve.js";
import { ConfigModule } from "../config/configModule.js";
import { Heartbeats, type HeartbeatsOptions } from "./heartbeats.js";

const { gatePermissionRequestMock } = vi.hoisted(() => ({
    gatePermissionRequestMock: vi.fn()
}));

vi.mock("../scheduling/gatePermissionRequest.js", () => ({
    gatePermissionRequest: gatePermissionRequestMock
}));

describe("Heartbeats", () => {
    const tempDirs: string[] = [];

    afterEach(async () => {
        await Promise.all(tempDirs.map((dir) => fs.rm(dir, { recursive: true, force: true })));
        tempDirs.length = 0;
        gatePermissionRequestMock.mockReset();
    });

    it("wires onGatePermissionRequest to gatePermissionRequest", async () => {
        const dir = await fs.mkdtemp(path.join(os.tmpdir(), "daycare-heartbeats-facade-"));
        tempDirs.push(dir);
        gatePermissionRequestMock.mockResolvedValue({ granted: true });

        const connectorRegistry = {} as HeartbeatsOptions["connectorRegistry"];
        const permissionRequestRegistry = {} as HeartbeatsOptions["permissionRequestRegistry"];
        const agentSystemMock = {
            permissionsForTarget: vi.fn(async () => ({
                workingDir: dir,
                writeDirs: [],
                readDirs: [],
                network: false,
                events: false
            })),
            agentIdForTarget: vi.fn(async () => "heartbeat-agent"),
            updateAgentPermissions: vi.fn(),
            postAndAwait: vi.fn(async () => ({ status: "completed" })),
            post: vi.fn(async () => undefined)
        };
        const agentSystem = agentSystemMock as unknown as HeartbeatsOptions["agentSystem"];
        const heartbeats = new Heartbeats({
            config: new ConfigModule(configResolve({ engine: { dataDir: dir } }, path.join(dir, "settings.json"))),
            eventBus: { emit: vi.fn() } as unknown as HeartbeatsOptions["eventBus"],
            agentSystem,
            connectorRegistry,
            permissionRequestRegistry
        });

        const callback = (
            heartbeats as unknown as {
                scheduler: { onGatePermissionRequest?: (task: unknown, missing: string[]) => Promise<boolean> };
            }
        ).scheduler.onGatePermissionRequest;
        expect(callback).toBeTypeOf("function");

        const granted = await callback?.(
            {
                id: "heartbeat-task-1",
                title: "Morning check",
                prompt: "Run checks",
                filePath: "/tmp/task.md"
            },
            ["@network"]
        );

        expect(granted).toBe(true);
        expect(gatePermissionRequestMock).toHaveBeenCalledWith(
            expect.objectContaining({
                missing: ["@network"],
                taskLabel: 'heartbeat task "Morning check" (heartbeat-task-1)',
                agentId: "heartbeat-agent",
                connectorRegistry,
                permissionRequestRegistry
            })
        );
    });
});
