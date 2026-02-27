import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createId } from "@paralleldrive/cuid2";
import { describe, expect, it } from "vitest";

import { configResolve } from "../../../config/configResolve.js";
import { storageOpen } from "../../../storage/storageOpen.js";
import { permissionBuildUser } from "../../permissions/permissionBuildUser.js";
import { UserHome } from "../../users/userHome.js";
import { contextForAgent } from "../context.js";
import { agentDescriptorWrite } from "./agentDescriptorWrite.js";
import { agentStateRead } from "./agentStateRead.js";
import { agentStateWrite } from "./agentStateWrite.js";
import type { AgentState } from "./agentTypes.js";

describe("agentStateRead", () => {
    it("reads persisted state and resolves inference session id from active session", async () => {
        const dir = await mkdtemp(path.join(os.tmpdir(), "daycare-agent-state-"));
        const agentId = createId();
        try {
            const config = configResolve({ engine: { dataDir: dir } }, path.join(dir, "settings.json"));
            const storage = await storageOpen(config.db.path);
            const userId = createId();
            const permissions = permissionBuildUser(new UserHome(config.usersDir, userId));
            const ctx = contextForAgent({ userId, agentId });
            await agentDescriptorWrite(
                storage,
                ctx,
                {
                    type: "cron",
                    id: agentId,
                    name: "state"
                },
                permissions
            );
            const sessionId = await storage.sessions.create({
                agentId,
                inferenceSessionId: "session-1",
                createdAt: 1
            });

            const state: AgentState = {
                context: {
                    messages: [{ role: "user", content: "hello", timestamp: 1 }]
                },
                activeSessionId: sessionId,
                permissions: { ...permissions },
                tokens: null,
                stats: {},
                createdAt: 1,
                updatedAt: 2,
                state: "active"
            };
            await agentStateWrite(config, ctx, state);

            const restored = await agentStateRead(config, ctx);

            expect(restored?.context.messages).toEqual([]);
            expect(restored?.inferenceSessionId).toBe("session-1");
            expect(restored?.activeSessionId).toBe(sessionId);
        } finally {
            await rm(dir, { recursive: true, force: true });
        }
    });

    it("returns null when state does not exist", async () => {
        const dir = await mkdtemp(path.join(os.tmpdir(), "daycare-agent-state-"));
        const agentId = createId();
        const ctx = contextForAgent({ userId: createId(), agentId });
        try {
            const config = configResolve({ engine: { dataDir: dir } }, path.join(dir, "settings.json"));
            await storageOpen(config.db.path);

            const restored = await agentStateRead(config, ctx);
            expect(restored).toBeNull();
        } finally {
            await rm(dir, { recursive: true, force: true });
        }
    });

    it("reads dead lifecycle state", async () => {
        const dir = await mkdtemp(path.join(os.tmpdir(), "daycare-agent-state-"));
        const agentId = createId();
        try {
            const config = configResolve({ engine: { dataDir: dir } }, path.join(dir, "settings.json"));
            const storage = await storageOpen(config.db.path);
            const userId = createId();
            const permissions = permissionBuildUser(new UserHome(config.usersDir, userId));
            const ctx = contextForAgent({ userId, agentId });
            await agentDescriptorWrite(
                storage,
                ctx,
                {
                    type: "cron",
                    id: agentId,
                    name: "state"
                },
                permissions
            );
            const state: AgentState = {
                context: { messages: [] },
                permissions: { ...permissions },
                tokens: null,
                stats: {},
                createdAt: 1,
                updatedAt: 2,
                state: "dead"
            };
            await agentStateWrite(config, ctx, state);

            const restored = await agentStateRead(config, ctx);

            expect(restored?.state).toBe("dead");
        } finally {
            await rm(dir, { recursive: true, force: true });
        }
    });
});
