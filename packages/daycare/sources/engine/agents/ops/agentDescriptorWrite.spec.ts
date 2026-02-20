import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { createId } from "@paralleldrive/cuid2";
import { afterEach, describe, expect, it, vi } from "vitest";

import { configResolve } from "../../../config/configResolve.js";
import { storageResolve } from "../../../storage/storageResolve.js";
import { agentDescriptorWrite } from "./agentDescriptorWrite.js";

describe("agentDescriptorWrite", () => {
    afterEach(() => {
        vi.restoreAllMocks();
    });

    it("updates updatedAt on every write while preserving createdAt", async () => {
        const dir = await mkdtemp(path.join(os.tmpdir(), "daycare-agent-descriptor-write-"));
        const agentId = createId();

        try {
            const config = configResolve(
                { engine: { dataDir: dir }, assistant: { workspaceDir: dir } },
                path.join(dir, "settings.json")
            );

            let now = 1000;
            vi.spyOn(Date, "now").mockImplementation(() => {
                now += 1;
                return now;
            });

            await agentDescriptorWrite(config, agentId, {
                type: "cron",
                id: agentId,
                name: "first"
            });
            const firstRecord = await storageResolve(config).agents.findById(agentId);

            await agentDescriptorWrite(config, agentId, {
                type: "cron",
                id: agentId,
                name: "second"
            });

            const secondRecord = await storageResolve(config).agents.findById(agentId);
            expect(firstRecord?.createdAt).toBe(firstRecord?.updatedAt);
            expect(secondRecord?.createdAt).toBe(firstRecord?.createdAt);
            expect(secondRecord?.updatedAt).toBeGreaterThan(firstRecord?.updatedAt ?? 0);
            expect(secondRecord?.descriptor).toEqual({
                type: "cron",
                id: agentId,
                name: "second"
            });
        } finally {
            await rm(dir, { recursive: true, force: true });
        }
    });
});
