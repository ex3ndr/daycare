import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it, vi } from "vitest";

import { configResolve } from "../../../config/configResolve.js";
import * as dockerContainersStaleRemoveModule from "../../../sandbox/docker/dockerContainersStaleRemove.js";
import * as dockerImageIdResolveModule from "../../../sandbox/docker/dockerImageIdResolve.js";
import { Engine } from "../../engine.js";
import { EngineEventBus } from "../../ipc/events.js";
import { montyPreambleBuild } from "./montyPreambleBuild.js";

describe("Monty tool surface", () => {
    it("keeps every registered tool representable for Python typing", async () => {
        const dir = await mkdtemp(path.join(os.tmpdir(), "daycare-monty-tools-"));
        const staleRemoveSpy = vi
            .spyOn(dockerContainersStaleRemoveModule, "dockerContainersStaleRemove")
            .mockResolvedValue(undefined);
        const imageIdSpy = vi
            .spyOn(dockerImageIdResolveModule, "dockerImageIdResolve")
            .mockResolvedValue("sha256:test");

        try {
            const config = configResolve({ engine: { dataDir: dir } }, path.join(dir, "settings.json"));
            const engine = new Engine({ config, eventBus: new EngineEventBus() });
            await engine.start();

            const tools = engine.modules.tools.listResolvedTools();
            expect(tools.length).toBeGreaterThan(0);
            for (const tool of tools) {
                expect(tool.returns.schema).toBeDefined();
            }
            expect(() => montyPreambleBuild(tools)).not.toThrow();

            await engine.shutdown();
        } finally {
            imageIdSpy.mockRestore();
            staleRemoveSpy.mockRestore();
            await rm(dir, { recursive: true, force: true });
        }
    });
});
