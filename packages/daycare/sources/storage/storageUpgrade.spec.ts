import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { configResolve } from "../config/configResolve.js";
import { storageUpgrade } from "./storageUpgrade.js";

describe("storageUpgrade", () => {
    it("applies migrations for a fresh database and no-ops when current", async () => {
        const dir = await mkdtemp(path.join(os.tmpdir(), "daycare-storage-upgrade-"));
        try {
            const config = configResolve(
                {
                    engine: { dataDir: dir },
                    assistant: { workspaceDir: dir }
                },
                path.join(dir, "settings.json")
            );

            const first = await storageUpgrade(config);
            const second = await storageUpgrade(config);

            expect(first.pendingBefore.length).toBeGreaterThan(0);
            expect(first.applied.length).toBeGreaterThan(0);
            expect(second.pendingBefore).toEqual([]);
            expect(second.applied).toEqual([]);
        } finally {
            await rm(dir, { recursive: true, force: true });
        }
    });
});
