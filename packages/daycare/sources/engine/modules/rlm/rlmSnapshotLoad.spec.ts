import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { createId } from "@paralleldrive/cuid2";
import { describe, expect, it } from "vitest";

import { configResolve } from "../../../config/configResolve.js";
import { storageOpenTest } from "../../../storage/storageOpenTest.js";
import { permissionBuildUser } from "../../permissions/permissionBuildUser.js";
import { UserHome } from "../../users/userHome.js";
import { rlmSnapshotLoad } from "./rlmSnapshotLoad.js";

describe("rlmSnapshotLoad", () => {
    it("returns null for invalid or missing snapshot ids", async () => {
        const dir = await mkdtemp(path.join(os.tmpdir(), "daycare-rlm-snapshot-"));
        try {
            const config = configResolve({ engine: { dataDir: dir } }, path.join(dir, "settings.json"));
            const storage = storageOpenTest(config.dbPath);
            try {
                const user = await storage.createUser({});
                const agentId = createId();
                const permissions = permissionBuildUser(new UserHome(config.usersDir, user.id));
                await storage.agents.create({
                    id: agentId,
                    userId: user.id,
                    type: "cron",
                    descriptor: { type: "cron", id: agentId, name: "sync" },
                    activeSessionId: null,
                    permissions,
                    tokens: null,
                    stats: {},
                    lifecycle: "active",
                    createdAt: 1,
                    updatedAt: 1
                });

                const invalid = await rlmSnapshotLoad({
                    config,
                    agentId,
                    sessionId: createId(),
                    snapshotId: "not-cuid2"
                });
                expect(invalid).toBeNull();

                const missing = await rlmSnapshotLoad({
                    config,
                    agentId,
                    sessionId: createId(),
                    snapshotId: createId()
                });
                expect(missing).toBeNull();
            } finally {
                storage.db.close();
            }
        } finally {
            await rm(dir, { recursive: true, force: true });
        }
    });
});
