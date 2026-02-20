import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createId } from "@paralleldrive/cuid2";
import { describe, expect, it } from "vitest";
import type { AgentDescriptor, AgentLifecycleState, AgentTokenEntry } from "@/types";
import { configResolve } from "../config/configResolve.js";
import { agentDbList } from "./agentDbList.js";
import { agentDbRead } from "./agentDbRead.js";
import { agentDbWrite } from "./agentDbWrite.js";
import { storageUpgrade } from "./storageUpgrade.js";

describe("agentDb", () => {
    it("roundtrips one agent row", async () => {
        const dir = await mkdtemp(path.join(os.tmpdir(), "daycare-agent-db-"));
        try {
            const config = configResolve(
                { engine: { dataDir: dir }, assistant: { workspaceDir: dir } },
                path.join(dir, "settings.json")
            );
            await storageUpgrade(config);

            const descriptor: AgentDescriptor = {
                type: "subagent",
                id: createId(),
                parentAgentId: createId(),
                name: "worker"
            };
            const tokens: AgentTokenEntry = {
                provider: "openai",
                model: "gpt-4.1",
                size: {
                    input: 10,
                    output: 4,
                    cacheRead: 0,
                    cacheWrite: 0,
                    total: 14
                }
            };
            const agentId = createId();
            const ownerUserId = createId();
            await agentDbWrite(config, {
                id: agentId,
                userId: ownerUserId,
                type: descriptor.type,
                descriptor,
                activeSessionId: createId(),
                permissions: config.defaultPermissions,
                tokens,
                stats: {
                    openai: {
                        "gpt-4.1": { input: 10, output: 4, cacheRead: 0, cacheWrite: 0, total: 14 }
                    }
                },
                lifecycle: "active",
                createdAt: 1,
                updatedAt: 2
            });

            const restored = await agentDbRead(config, agentId);
            expect(restored).toEqual({
                id: agentId,
                userId: ownerUserId,
                type: descriptor.type,
                descriptor,
                activeSessionId: expect.any(String),
                permissions: config.defaultPermissions,
                tokens,
                stats: {
                    openai: {
                        "gpt-4.1": { input: 10, output: 4, cacheRead: 0, cacheWrite: 0, total: 14 }
                    }
                },
                lifecycle: "active",
                createdAt: 1,
                updatedAt: 2
            });
        } finally {
            await rm(dir, { recursive: true, force: true });
        }
    });

    it("lists multiple agents", async () => {
        const dir = await mkdtemp(path.join(os.tmpdir(), "daycare-agent-db-"));
        try {
            const config = configResolve(
                { engine: { dataDir: dir }, assistant: { workspaceDir: dir } },
                path.join(dir, "settings.json")
            );
            await storageUpgrade(config);

            const agentIds = [createId(), createId()];
            const lifecycles: AgentLifecycleState[] = ["sleeping", "dead"];

            for (let index = 0; index < agentIds.length; index += 1) {
                const agentId = agentIds[index];
                const lifecycle = lifecycles[index];
                if (!agentId || !lifecycle) {
                    throw new Error("Missing test fixtures");
                }
                const descriptor: AgentDescriptor = {
                    type: "cron",
                    id: agentId,
                    name: `cron-${index}`
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
                    lifecycle,
                    createdAt: index + 1,
                    updatedAt: index + 10
                });
            }

            const listed = await agentDbList(config);
            expect(listed).toHaveLength(2);
            expect(new Set(listed.map((entry) => entry.lifecycle))).toEqual(new Set(["sleeping", "dead"]));
        } finally {
            await rm(dir, { recursive: true, force: true });
        }
    });
});
