import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createId } from "@paralleldrive/cuid2";
import { describe, expect, it } from "vitest";

import type { AgentDescriptor } from "@/types";
import { configResolve } from "../config/configResolve.js";
import { agentDbWrite } from "./agentDbWrite.js";
import { sessionDbCreate } from "./sessionDbCreate.js";
import { sessionDbListForAgent } from "./sessionDbListForAgent.js";
import { sessionDbRead } from "./sessionDbRead.js";
import { storageUpgrade } from "./storageUpgrade.js";

describe("sessionDb", () => {
    it("creates and reads sessions", async () => {
        const dir = await mkdtemp(path.join(os.tmpdir(), "daycare-session-db-"));
        try {
            const config = configResolve(
                { engine: { dataDir: dir }, assistant: { workspaceDir: dir } },
                path.join(dir, "settings.json")
            );
            await storageUpgrade(config);

            const agentId = createId();
            const descriptor: AgentDescriptor = {
                type: "cron",
                id: agentId,
                name: "cron"
            };
            await agentDbWrite(config, {
                id: agentId,
                userId: createId(),
                type: descriptor.type,
                descriptor,
                activeSessionId: null,
                permissions: config.defaultPermissions,
                tokens: null,
                stats: {},
                lifecycle: "active",
                createdAt: 1,
                updatedAt: 1
            });

            const sessionId = await sessionDbCreate(config, {
                agentId,
                inferenceSessionId: "infer-1",
                createdAt: 100,
                resetMessage: "manual reset"
            });

            const restored = await sessionDbRead(config, sessionId);
            expect(restored).toEqual({
                id: sessionId,
                agentId,
                inferenceSessionId: "infer-1",
                createdAt: 100,
                resetMessage: "manual reset"
            });
        } finally {
            await rm(dir, { recursive: true, force: true });
        }
    });

    it("lists sessions for one agent ordered by createdAt", async () => {
        const dir = await mkdtemp(path.join(os.tmpdir(), "daycare-session-db-"));
        try {
            const config = configResolve(
                { engine: { dataDir: dir }, assistant: { workspaceDir: dir } },
                path.join(dir, "settings.json")
            );
            await storageUpgrade(config);

            const agentA = createId();
            const agentB = createId();
            for (const agentId of [agentA, agentB]) {
                const descriptor: AgentDescriptor = {
                    type: "cron",
                    id: agentId,
                    name: `cron-${agentId}`
                };
                await agentDbWrite(config, {
                    id: agentId,
                    userId: createId(),
                    type: descriptor.type,
                    descriptor,
                    activeSessionId: null,
                    permissions: config.defaultPermissions,
                    tokens: null,
                    stats: {},
                    lifecycle: "active",
                    createdAt: 1,
                    updatedAt: 1
                });
            }

            await sessionDbCreate(config, { agentId: agentA, createdAt: 20 });
            await sessionDbCreate(config, { agentId: agentB, createdAt: 10 });
            await sessionDbCreate(config, { agentId: agentA, createdAt: 30 });

            const sessions = await sessionDbListForAgent(config, agentA);
            expect(sessions).toHaveLength(2);
            expect(sessions[0]?.createdAt).toBe(20);
            expect(sessions[1]?.createdAt).toBe(30);
        } finally {
            await rm(dir, { recursive: true, force: true });
        }
    });
});
