import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { createId } from "@paralleldrive/cuid2";
import { describe, expect, it } from "vitest";

import { configResolve } from "../../../config/configResolve.js";
import { storageOpenTest } from "../../../storage/storageOpenTest.js";
import { cuid2Is } from "../../../utils/cuid2Is.js";
import { permissionBuildUser } from "../../permissions/permissionBuildUser.js";
import { UserHome } from "../../users/userHome.js";
import { rlmSnapshotLoad } from "./rlmSnapshotLoad.js";
import { rlmSnapshotSave } from "./rlmSnapshotSave.js";

describe("rlmSnapshotSave", () => {
    it("creates snapshot file and returns cuid2 id", async () => {
        const dir = await mkdtemp(path.join(os.tmpdir(), "daycare-rlm-snapshot-"));
        try {
            const config = configResolve({ engine: { dataDir: dir } }, path.join(dir, "settings.json"));
            const storage = storageOpenTest();
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

                const snapshotDump = Buffer.from([1, 2, 3]).toString("base64");
                const sessionId = createId();
                const snapshotId = await rlmSnapshotSave({
                    config,
                    agentId,
                    sessionId,
                    snapshotDump
                });

                expect(cuid2Is(snapshotId)).toBe(true);
                const loaded = await rlmSnapshotLoad({
                    config,
                    agentId,
                    sessionId,
                    snapshotId
                });
                expect(loaded).toEqual(Buffer.from([1, 2, 3]));
            } finally {
                storage.db.close();
            }
        } finally {
            await rm(dir, { recursive: true, force: true });
        }
    });
});
