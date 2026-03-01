import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createId } from "@paralleldrive/cuid2";
import { describe, expect, it } from "vitest";

import { configResolve } from "../../../config/configResolve.js";
import { storageResolve } from "../../../storage/storageResolve.js";
import { storageUpgrade } from "../../../storage/storageUpgrade.js";
import { permissionBuildUser } from "../../permissions/permissionBuildUser.js";
import { UserHome } from "../../users/userHome.js";
import { contextForAgent } from "../context.js";
import { agentHistoryAppend } from "./agentHistoryAppend.js";
import { agentHistoryLoadAll } from "./agentHistoryLoadAll.js";
import { agentStateRead } from "./agentStateRead.js";
import { agentStateWrite } from "./agentStateWrite.js";
import { agentWrite } from "./agentWrite.js";

describe("agentHistoryLoadAll", () => {
    it("returns records across all sessions", async () => {
        const dir = await mkdtemp(path.join(os.tmpdir(), "daycare-agent-history-all-"));
        const agentId = createId();
        try {
            const config = configResolve({ engine: { dataDir: dir } }, path.join(dir, "settings.json"));
            await storageUpgrade(config);
            const userId = createId();
            const permissions = permissionBuildUser(new UserHome(config.usersDir, userId));
            const ctx = contextForAgent({ userId, agentId });
            await agentWrite(
                storageResolve(config),
                ctx,
                `/${userId}/cron/${agentId}`,
                {
                    foreground: false,
                    name: "history",
                    description: null,
                    systemPrompt: null,
                    workspaceDir: null
                },
                permissions
            );

            const initial = await agentStateRead(config, ctx);
            if (!initial) {
                throw new Error("State missing");
            }

            const firstSession = await storageResolve(config).sessions.create({ agentId, createdAt: 1 });
            await agentStateWrite(config, ctx, { ...initial, activeSessionId: firstSession });
            await agentHistoryAppend(config, ctx, {
                type: "user_message",
                at: 2,
                text: "before",
                files: []
            });

            const secondSession = await storageResolve(config).sessions.create({ agentId, createdAt: 3 });
            await agentStateWrite(config, ctx, {
                ...initial,
                activeSessionId: secondSession,
                updatedAt: 3
            });
            await agentHistoryAppend(config, ctx, {
                type: "user_message",
                at: 4,
                text: "after",
                files: []
            });

            const records = await agentHistoryLoadAll(config, ctx);
            expect(records).toEqual([
                { type: "user_message", at: 2, text: "before", files: [] },
                { type: "user_message", at: 4, text: "after", files: [] }
            ]);
        } finally {
            await rm(dir, { recursive: true, force: true });
        }
    });
});
