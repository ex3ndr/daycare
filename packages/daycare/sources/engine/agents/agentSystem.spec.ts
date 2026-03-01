import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createId } from "@paralleldrive/cuid2";
import { describe, expect, it, vi } from "vitest";

import type {
    AgentCreationConfig,
    AgentInboxItem,
    AgentInboxResult,
    AgentPath,
    AgentPostTarget,
    Context
} from "@/types";
import { AuthStore } from "../../auth/store.js";
import { configResolve } from "../../config/configResolve.js";
import type { Storage } from "../../storage/storage.js";
import { storageOpen } from "../../storage/storageOpen.js";
import { userConnectorKeyCreate } from "../../storage/userConnectorKeyCreate.js";
import { ConfigModule } from "../config/configModule.js";
import type { Crons } from "../cron/crons.js";
import { EngineEventBus } from "../ipc/events.js";
import { ConnectorRegistry } from "../modules/connectorRegistry.js";
import { ImageGenerationRegistry } from "../modules/imageGenerationRegistry.js";
import type { InferenceRouter } from "../modules/inference/router.js";
import { MediaAnalysisRegistry } from "../modules/mediaAnalysisRegistry.js";
import { ToolResolver } from "../modules/toolResolver.js";
import type { PluginManager } from "../plugins/manager.js";
import { DelayedSignals } from "../signals/delayedSignals.js";
import { Signals } from "../signals/signals.js";
import {
    type AgentLegacyDescriptor,
    agentCreationConfigFromLegacyDescriptor,
    agentPathFromLegacyDescriptor
} from "./agentLegacyDescriptorTestUtils.js";
import { AgentSystem } from "./agentSystem.js";
import { contextForAgent, contextForUser } from "./context.js";
import { agentPathChildAllocate } from "./ops/agentPathChildAllocate.js";
import { agentPath } from "./ops/agentPathTypes.js";
import { agentStateRead } from "./ops/agentStateRead.js";
import { agentStateWrite } from "./ops/agentStateWrite.js";

const POISON_PILL_DELAY_MS = 3_600_000;
const POISON_PILL_REPEAT_KEY = "lifecycle-poison-pill";

describe("AgentSystem", () => {
    it("schedules poison-pill one hour after a subagent sleeps", async () => {
        vi.useFakeTimers();
        const dir = await mkdtemp(path.join(os.tmpdir(), "daycare-agent-system-"));
        let delayedSignals: DelayedSignals | null = null;
        try {
            vi.setSystemTime(new Date("2025-01-01T00:00:00.000Z"));
            const harness = await harnessCreate(dir);
            delayedSignals = harness.delayedSignals;
            await harness.agentSystem.load();
            await harness.agentSystem.start();

            const agentId = await subagentCreate(harness.agentSystem, harness.eventBus);
            const poison = delayedSignals.list().find((event) => event.type === `agent:${agentId}:poison-pill`);

            expect(poison).toBeTruthy();
            expect(poison?.repeatKey).toBe(POISON_PILL_REPEAT_KEY);
            expect(poison?.deliverAt).toBe(Date.now() + POISON_PILL_DELAY_MS);
        } finally {
            delayedSignals?.stop();
            vi.useRealTimers();
            await rm(dir, { recursive: true, force: true });
        }
    });

    it("cancels and reschedules poison-pill when a sleeping subagent wakes", async () => {
        vi.useFakeTimers();
        const dir = await mkdtemp(path.join(os.tmpdir(), "daycare-agent-system-"));
        let delayedSignals: DelayedSignals | null = null;
        try {
            vi.setSystemTime(new Date("2025-01-01T00:00:00.000Z"));
            const harness = await harnessCreate(dir);
            delayedSignals = harness.delayedSignals;
            await harness.agentSystem.load();
            await harness.agentSystem.start();

            const agentId = await subagentCreate(harness.agentSystem, harness.eventBus);
            const signalType = `agent:${agentId}:poison-pill`;
            const firstSchedule = delayedSignals.list().find((event) => event.type === signalType);
            expect(firstSchedule).toBeTruthy();

            vi.setSystemTime(new Date("2025-01-01T00:30:00.000Z"));
            await postAndAwait(harness.agentSystem, { agentId }, { type: "reset", message: "wake and sleep again" });

            const poisonSignals = delayedSignals.list().filter((event) => event.type === signalType);
            expect(poisonSignals).toHaveLength(1);
            expect(poisonSignals[0]?.deliverAt).toBe(Date.now() + POISON_PILL_DELAY_MS);
            expect(poisonSignals[0]?.deliverAt).toBeGreaterThan(firstSchedule?.deliverAt ?? 0);
        } finally {
            delayedSignals?.stop();
            vi.useRealTimers();
            await rm(dir, { recursive: true, force: true });
        }
    });

    it("does not schedule poison-pill for non-subagent agents", async () => {
        vi.useFakeTimers();
        const dir = await mkdtemp(path.join(os.tmpdir(), "daycare-agent-system-"));
        let delayedSignals: DelayedSignals | null = null;
        try {
            const harness = await harnessCreate(dir);
            delayedSignals = harness.delayedSignals;
            await harness.agentSystem.load();
            await harness.agentSystem.start();

            const agentId = createId();
            const descriptor: AgentLegacyDescriptor = { type: "cron", id: agentId, name: "cron-worker" };
            await postAndAwait(harness.agentSystem, { descriptor }, { type: "reset", message: "init cron" });

            expect(delayedSignals.list().some((event) => event.type === `agent:${agentId}:poison-pill`)).toBe(false);
        } finally {
            delayedSignals?.stop();
            vi.useRealTimers();
            await rm(dir, { recursive: true, force: true });
        }
    });

    it("reuses cuid2 task descriptor id as the persistent agent id", async () => {
        const dir = await mkdtemp(path.join(os.tmpdir(), "daycare-agent-system-"));
        try {
            const harness = await harnessCreate(dir);
            await harness.agentSystem.load();
            await harness.agentSystem.start();

            const descriptor: AgentLegacyDescriptor = { type: "task", id: createId() };
            const ownerCtx = await harness.agentSystem.ownerCtxEnsure();
            await postAndAwait(harness.agentSystem, ownerCtx, { descriptor }, { type: "reset", message: "task init" });
            const firstAgentId = await agentIdForTarget(harness.agentSystem, ownerCtx, { descriptor });

            await postAndAwait(harness.agentSystem, ownerCtx, { descriptor }, { type: "reset", message: "task rerun" });
            const secondAgentId = await agentIdForTarget(harness.agentSystem, ownerCtx, { descriptor });

            expect(firstAgentId).toBe(descriptor.id);
            expect(secondAgentId).toBe(descriptor.id);
        } finally {
            await rm(dir, { recursive: true, force: true });
        }
    });

    it("marks sleeping subagents dead when the poison-pill signal fires", async () => {
        vi.useFakeTimers();
        const dir = await mkdtemp(path.join(os.tmpdir(), "daycare-agent-system-"));
        let delayedSignals: DelayedSignals | null = null;
        try {
            const harness = await harnessCreate(dir);
            delayedSignals = harness.delayedSignals;
            await delayedSignals.start();
            await harness.agentSystem.load();
            await harness.agentSystem.start();

            const agentId = await subagentCreate(harness.agentSystem, harness.eventBus);
            await vi.advanceTimersByTimeAsync(POISON_PILL_DELAY_MS);
            await vi.waitFor(async () => {
                const state = await agentStateRead(
                    harness.storage,
                    await contextForAgentIdRequire(harness.agentSystem, agentId)
                );
                expect(state?.state).toBe("dead");
            });
        } finally {
            delayedSignals?.stop();
            vi.useRealTimers();
            await rm(dir, { recursive: true, force: true });
        }
    });

    it("ignores poison-pill signals for non-subagent agents", async () => {
        const dir = await mkdtemp(path.join(os.tmpdir(), "daycare-agent-system-"));
        let delayedSignals: DelayedSignals | null = null;
        try {
            const harness = await harnessCreate(dir);
            delayedSignals = harness.delayedSignals;
            await delayedSignals.start();
            await harness.agentSystem.load();
            await harness.agentSystem.start();

            const agentId = createId();
            const descriptor: AgentLegacyDescriptor = { type: "cron", id: agentId, name: "cron-worker" };
            await postAndAwait(harness.agentSystem, { descriptor }, { type: "reset", message: "init cron" });
            await harness.signals.generate({
                type: `agent:${agentId}:poison-pill`,
                source: { type: "system", userId: "user-1" }
            });

            const state = await agentStateRead(
                harness.storage,
                await contextForAgentIdRequire(harness.agentSystem, agentId)
            );
            expect(state?.state).toBe("sleeping");
        } finally {
            delayedSignals?.stop();
            await rm(dir, { recursive: true, force: true });
        }
    });

    it("kills active subagents after poison-pill delivery and rejects queued completions", async () => {
        const dir = await mkdtemp(path.join(os.tmpdir(), "daycare-agent-system-"));
        let delayedSignals: DelayedSignals | null = null;
        try {
            let releaseFirstInference!: () => void;
            const firstInferenceGate = new Promise<void>((resolve) => {
                releaseFirstInference = () => resolve();
            });
            let inferenceCalls = 0;
            const complete = vi.fn(async () => {
                inferenceCalls += 1;
                if (inferenceCalls === 1) {
                    await firstInferenceGate;
                }
                return inferenceResponse("done");
            });
            const inferenceRouter: InferenceRouter = {
                complete
            } as unknown as InferenceRouter;

            const harness = await harnessCreate(dir, { inferenceRouter });
            delayedSignals = harness.delayedSignals;
            await delayedSignals.start();
            await harness.agentSystem.load();
            await harness.agentSystem.start();

            const agentId = await subagentCreate(harness.agentSystem, harness.eventBus);
            await post(
                harness.agentSystem,
                { agentId },
                { type: "message", message: { text: "start long work" }, context: {} }
            );
            await vi.waitFor(() => {
                expect(complete.mock.calls.length).toBe(1);
            });

            await harness.signals.generate({
                type: `agent:${agentId}:poison-pill`,
                source: { type: "system", userId: "user-1" }
            });
            const queued = postAndAwait(
                harness.agentSystem,
                { agentId },
                { type: "reset", message: "queued after poison-pill" }
            );

            releaseFirstInference();

            await expect(queued).rejects.toThrow(`Agent is dead: ${agentId}`);
            await vi.waitFor(() => {
                const calls = complete.mock.calls.length;
                expect(calls).toBeGreaterThanOrEqual(2);
            });
            await expect(
                postAndAwait(harness.agentSystem, { agentId }, { type: "reset", message: "dead check" })
            ).rejects.toThrow(`Agent is dead: ${agentId}`);
            await vi.waitFor(async () => {
                const state = await agentStateRead(
                    harness.storage,
                    await contextForAgentIdRequire(harness.agentSystem, agentId)
                );
                expect(state?.state).toBe("dead");
            });
        } finally {
            delayedSignals?.stop();
            await rm(dir, { recursive: true, force: true });
        }
    });

    it("restores sleeping subagents with past poison-pill deadlines and marks them dead", async () => {
        vi.useFakeTimers();
        const dir = await mkdtemp(path.join(os.tmpdir(), "daycare-agent-system-"));
        let delayedSignalsA: DelayedSignals | null = null;
        let delayedSignalsB: DelayedSignals | null = null;
        try {
            vi.setSystemTime(new Date("2025-01-01T00:00:00.000Z"));
            const first = await harnessCreate(dir);
            delayedSignalsA = first.delayedSignals;
            await delayedSignalsA.start();
            await first.agentSystem.load();
            await first.agentSystem.start();

            const agentId = await subagentCreate(first.agentSystem, first.eventBus);
            const beforeRestart = await agentStateRead(
                first.storage,
                await contextForAgentIdRequire(first.agentSystem, agentId)
            );
            expect(beforeRestart?.state).toBe("sleeping");
            delayedSignalsA.stop();

            vi.setSystemTime(new Date((beforeRestart?.updatedAt ?? 0) + POISON_PILL_DELAY_MS + 1));
            const second = await harnessCreate(dir);
            delayedSignalsB = second.delayedSignals;
            await second.agentSystem.load();
            await second.agentSystem.start();
            await delayedSignalsB.start();

            await vi.waitFor(async () => {
                const state = await agentStateRead(
                    second.storage,
                    await contextForAgentIdRequire(second.agentSystem, agentId)
                );
                expect(state?.state).toBe("dead");
            });
        } finally {
            delayedSignalsA?.stop();
            delayedSignalsB?.stop();
            vi.useRealTimers();
            await rm(dir, { recursive: true, force: true });
        }
    });

    it("restores sleeping subagents with future deadlines by scheduling remaining poison-pill time", async () => {
        vi.useFakeTimers();
        const dir = await mkdtemp(path.join(os.tmpdir(), "daycare-agent-system-"));
        let delayedSignalsA: DelayedSignals | null = null;
        let delayedSignalsB: DelayedSignals | null = null;
        try {
            vi.setSystemTime(new Date("2025-01-01T00:00:00.000Z"));
            const first = await harnessCreate(dir);
            delayedSignalsA = first.delayedSignals;
            await delayedSignalsA.start();
            await first.agentSystem.load();
            await first.agentSystem.start();

            const agentId = await subagentCreate(first.agentSystem, first.eventBus);
            const beforeRestart = await agentStateRead(
                first.storage,
                await contextForAgentIdRequire(first.agentSystem, agentId)
            );
            expect(beforeRestart?.state).toBe("sleeping");
            delayedSignalsA.stop();

            vi.setSystemTime(new Date((beforeRestart?.updatedAt ?? 0) + 30 * 60 * 1000));
            const second = await harnessCreate(dir);
            delayedSignalsB = second.delayedSignals;
            await second.agentSystem.load();
            const signalType = `agent:${agentId}:poison-pill`;
            const scheduled = delayedSignalsB.list().find((event) => event.type === signalType);
            expect(scheduled?.deliverAt).toBe((beforeRestart?.updatedAt ?? 0) + POISON_PILL_DELAY_MS);
        } finally {
            delayedSignalsA?.stop();
            delayedSignalsB?.stop();
            vi.useRealTimers();
            await rm(dir, { recursive: true, force: true });
        }
    });

    it("skips already-dead subagents on load and does not schedule poison-pill signals", async () => {
        vi.useFakeTimers();
        const dir = await mkdtemp(path.join(os.tmpdir(), "daycare-agent-system-"));
        let delayedSignalsA: DelayedSignals | null = null;
        let delayedSignalsB: DelayedSignals | null = null;
        try {
            const first = await harnessCreate(dir);
            delayedSignalsA = first.delayedSignals;
            await delayedSignalsA.start();
            await first.agentSystem.load();
            await first.agentSystem.start();

            const agentId = await subagentCreate(first.agentSystem, first.eventBus);
            const current = await agentStateRead(
                first.storage,
                await contextForAgentIdRequire(first.agentSystem, agentId)
            );
            if (!current) {
                throw new Error("Missing state for subagent");
            }
            const deadState = { ...current, state: "dead" as const, updatedAt: Date.now() };
            await agentStateWrite(first.storage, await contextForAgentIdRequire(first.agentSystem, agentId), deadState);
            delayedSignalsA.stop();

            const second = await harnessCreate(dir);
            delayedSignalsB = second.delayedSignals;
            await second.agentSystem.load();
            expect(delayedSignalsB.list().some((event) => event.type === `agent:${agentId}:poison-pill`)).toBe(false);
            await expect(
                postAndAwait(second.agentSystem, { agentId }, { type: "reset", message: "dead restore" })
            ).rejects.toThrow(`Agent is dead: ${agentId}`);
        } finally {
            delayedSignalsA?.stop();
            delayedSignalsB?.stop();
            vi.useRealTimers();
            await rm(dir, { recursive: true, force: true });
        }
    });

    it("auto-creates a user for a new connector identity", async () => {
        const dir = await mkdtemp(path.join(os.tmpdir(), "daycare-agent-system-"));
        try {
            const harness = await harnessCreate(dir);
            await harness.agentSystem.load();
            await harness.agentSystem.start();

            const descriptor: AgentLegacyDescriptor = {
                type: "user",
                connector: "telegram",
                userId: "connector-user-1",
                channelId: "channel-a"
            };
            await postAndAwait(harness.agentSystem, { descriptor }, { type: "reset", message: "init user" });
            const agentId = await agentIdForTarget(harness.agentSystem, { descriptor });
            const ctx = await harness.agentSystem.contextForAgentId(agentId);
            const linked = await harness.storage.users.findByConnectorKey("telegram:connector-user-1");

            expect(ctx).toBeTruthy();
            expect(linked?.id).toBe(ctx!.userId);
        } finally {
            await rm(dir, { recursive: true, force: true });
        }
    });

    it("assigns user agents permissions scoped to their UserHome", async () => {
        const dir = await mkdtemp(path.join(os.tmpdir(), "daycare-agent-system-"));
        try {
            const harness = await harnessCreate(dir);
            await harness.agentSystem.load();
            await harness.agentSystem.start();

            const descriptor: AgentLegacyDescriptor = {
                type: "user",
                connector: "telegram",
                userId: "connector-user-scope",
                channelId: "channel-a"
            };
            await postAndAwait(harness.agentSystem, { descriptor }, { type: "reset", message: "init scoped user" });
            const agentId = await agentIdForTarget(harness.agentSystem, { descriptor });
            const context = await harness.agentSystem.contextForAgentId(agentId);
            if (!context) {
                throw new Error("Agent context missing");
            }
            const state = await agentStateRead(
                harness.storage,
                await contextForAgentIdRequire(harness.agentSystem, agentId)
            );
            if (!state) {
                throw new Error("Agent state missing");
            }

            const expectedHome = path.join(harness.config.usersDir, context.userId, "home");
            const expectedDesktop = path.join(expectedHome, "desktop");

            expect(state.permissions.workingDir).toBe(expectedDesktop);
            expect(state.permissions.writeDirs).toEqual([expectedHome]);
        } finally {
            await rm(dir, { recursive: true, force: true });
        }
    });

    it("reuses existing user for known connector identity across channels", async () => {
        const dir = await mkdtemp(path.join(os.tmpdir(), "daycare-agent-system-"));
        try {
            const harness = await harnessCreate(dir);
            await harness.agentSystem.load();
            await harness.agentSystem.start();

            const first: AgentLegacyDescriptor = {
                type: "user",
                connector: "telegram",
                userId: "connector-user-2",
                channelId: "channel-a"
            };
            const second: AgentLegacyDescriptor = {
                type: "user",
                connector: "telegram",
                userId: "connector-user-2",
                channelId: "channel-b"
            };
            await postAndAwait(harness.agentSystem, { descriptor: first }, { type: "reset", message: "first" });
            await postAndAwait(harness.agentSystem, { descriptor: second }, { type: "reset", message: "second" });

            const firstAgentId = await agentIdForTarget(harness.agentSystem, { descriptor: first });
            const secondAgentId = await agentIdForTarget(harness.agentSystem, { descriptor: second });
            const firstContext = await harness.agentSystem.contextForAgentId(firstAgentId);
            const secondContext = await harness.agentSystem.contextForAgentId(secondAgentId);

            expect(firstContext?.userId).toBeTruthy();
            expect(secondContext?.userId).toBe(firstContext?.userId);
        } finally {
            await rm(dir, { recursive: true, force: true });
        }
    });

    it("inherits parent userId for subagents", async () => {
        const dir = await mkdtemp(path.join(os.tmpdir(), "daycare-agent-system-"));
        try {
            const harness = await harnessCreate(dir);
            await harness.agentSystem.load();
            await harness.agentSystem.start();

            const parentDescriptor: AgentLegacyDescriptor = {
                type: "user",
                connector: "telegram",
                userId: "connector-user-3",
                channelId: "channel-a"
            };
            await postAndAwait(
                harness.agentSystem,
                { descriptor: parentDescriptor },
                { type: "reset", message: "parent" }
            );
            const parentAgentId = await agentIdForTarget(harness.agentSystem, { descriptor: parentDescriptor });
            const parentContext = await harness.agentSystem.contextForAgentId(parentAgentId);
            if (!parentContext) {
                throw new Error("Parent agent context missing");
            }

            const subagentPath = await agentPathChildAllocate({
                storage: harness.agentSystem.storage,
                parentAgentId,
                kind: "sub"
            });
            await postAndAwait(
                harness.agentSystem,
                parentContext,
                { path: subagentPath },
                { type: "reset", message: "subagent" }
            );
            const subagentId = await agentIdForTarget(harness.agentSystem, parentContext, { path: subagentPath });
            const subagentContext = await harness.agentSystem.contextForAgentId(subagentId);

            expect(subagentContext?.userId).toBe(parentContext.userId);
        } finally {
            await rm(dir, { recursive: true, force: true });
        }
    });

    it("prefers active telegram foreground agents for most-recent-foreground strategy", async () => {
        const dir = await mkdtemp(path.join(os.tmpdir(), "daycare-agent-system-"));
        try {
            const harness = await harnessCreate(dir);
            const ownerCtx = await harness.agentSystem.ownerCtxEnsure();
            const now = Date.now();
            const permissions = { workingDir: "/tmp", writeDirs: ["/tmp"] };

            await harness.storage.agents.create({
                id: "tg-agent",
                userId: ownerCtx.userId,
                type: "user",
                descriptor: { type: "user", connector: "telegram", userId: "tg-ext", channelId: "tg-ext" },
                path: agentPath(`/${ownerCtx.userId}/telegram`),
                config: null,
                nextSubIndex: 0,
                activeSessionId: null,
                permissions,
                tokens: null,
                stats: {},
                lifecycle: "active",
                createdAt: now - 10_000,
                updatedAt: now - 10_000
            });
            await agentStateWrite(harness.storage, contextForAgent({ userId: ownerCtx.userId, agentId: "tg-agent" }), {
                context: { messages: [] },
                activeSessionId: null,
                permissions,
                tokens: null,
                stats: {},
                createdAt: now - 10_000,
                updatedAt: now - 10_000,
                state: "active",
                modelOverride: null
            });

            await harness.storage.agents.create({
                id: "wa-agent",
                userId: ownerCtx.userId,
                type: "user",
                descriptor: { type: "user", connector: "whatsapp", userId: "wa-ext", channelId: "wa-ext" },
                path: agentPath(`/${ownerCtx.userId}/whatsapp`),
                config: null,
                nextSubIndex: 0,
                activeSessionId: null,
                permissions,
                tokens: null,
                stats: {},
                lifecycle: "active",
                createdAt: now - 1_000,
                updatedAt: now - 1_000
            });
            await agentStateWrite(harness.storage, contextForAgent({ userId: ownerCtx.userId, agentId: "wa-agent" }), {
                context: { messages: [] },
                activeSessionId: null,
                permissions,
                tokens: null,
                stats: {},
                createdAt: now - 1_000,
                updatedAt: now - 1_000,
                state: "active",
                modelOverride: null
            });

            await harness.agentSystem.load();
            await harness.agentSystem.start();

            const target = harness.agentSystem.agentFor(ownerCtx, "most-recent-foreground");
            expect(target).toBe("tg-agent");
        } finally {
            await rm(dir, { recursive: true, force: true });
        }
    });

    it("creates swarm agents for swarm user paths", async () => {
        const dir = await mkdtemp(path.join(os.tmpdir(), "daycare-agent-system-"));
        try {
            const harness = await harnessCreate(dir);
            await harness.storage.users.create({ id: "swarm-user-1", isSwarm: true, nametag: "swarm-user-1" });
            await harness.agentSystem.load();
            await harness.agentSystem.start();

            const swarmCtx = contextForUser({ userId: "swarm-user-1" });
            const swarmPath = agentPath("/swarm-user-1/agent/swarm");
            await postAndAwait(harness.agentSystem, swarmCtx, { path: swarmPath }, { type: "reset", message: "swarm" });
            const swarmAgentId = await agentIdForTarget(harness.agentSystem, swarmCtx, { path: swarmPath });
            const persisted = await harness.storage.agents.findById(swarmAgentId);

            expect(persisted?.path).toBe("/swarm-user-1/agent/swarm");
            expect(persisted?.foreground).toBe(true);
        } finally {
            await rm(dir, { recursive: true, force: true });
        }
    });

    it("canonicalizes legacy swarm paths during load", async () => {
        const dir = await mkdtemp(path.join(os.tmpdir(), "daycare-agent-system-"));
        try {
            const harness = await harnessCreate(dir);
            await harness.storage.users.create({ id: "swarm-user-2", isSwarm: true, nametag: "swarm-user-2" });
            await harness.storage.agents.create({
                id: "legacy-swarm-agent",
                userId: "swarm-user-2",
                type: "swarm",
                descriptor: { type: "swarm", id: "swarm-user-2" },
                path: agentPath("/swarm-user-2/agent/legacy-swarm-agent"),
                activeSessionId: null,
                permissions: { workingDir: "/tmp", writeDirs: ["/tmp"] },
                tokens: null,
                stats: {},
                lifecycle: "active",
                createdAt: 1,
                updatedAt: 1
            });
            await harness.agentSystem.load();
            await harness.agentSystem.start();

            const swarmCtx = contextForUser({ userId: "swarm-user-2" });
            const canonicalPath = agentPath("/swarm-user-2/agent/swarm");
            const swarmAgentId = await agentIdForTarget(harness.agentSystem, swarmCtx, { path: canonicalPath });
            const persisted = await harness.storage.agents.findById(swarmAgentId);
            expect(persisted?.path).toBe(canonicalPath);
        } finally {
            await rm(dir, { recursive: true, force: true });
        }
    });

    it("keeps executable system-message failures inline without follow-up re-post", async () => {
        const dir = await mkdtemp(path.join(os.tmpdir(), "daycare-agent-system-"));
        try {
            const harness = await harnessCreate(dir);
            await harness.agentSystem.load();
            await harness.agentSystem.start();

            const postSpy = vi.spyOn(harness.agentSystem, "post");
            const descriptor: AgentLegacyDescriptor = { type: "task", id: createId() };
            const result = await postAndAwait(
                harness.agentSystem,
                { descriptor },
                {
                    type: "system_message",
                    text: "[cron]\ntriggerId: trigger-1\ntaskId: task-1",
                    code: "raise Exception('boom')",
                    origin: "cron"
                }
            );

            if (result.type !== "system_message") {
                throw new Error("Expected system_message result");
            }
            expect(result.responseError).toBe(true);
            expect(result.executionErrorText).toContain("boom");
            expect(result.responseText).toBe("ok");
            expect(postSpy).not.toHaveBeenCalled();
        } finally {
            await rm(dir, { recursive: true, force: true });
        }
    });

    it("posts cross-user items to all frontend agents for a target user", async () => {
        const dir = await mkdtemp(path.join(os.tmpdir(), "daycare-agent-system-"));
        try {
            const harness = await harnessCreate(dir);
            const user = await harness.storage.users.create({ id: "target-user", nametag: "target-user-42" });
            const permissions = { workingDir: "/tmp", writeDirs: ["/tmp"] };

            await harness.storage.agents.create({
                id: "user-agent-1",
                userId: user.id,
                type: "user",
                descriptor: { type: "user", connector: "telegram", userId: "conn", channelId: "chan-1" },
                path: agentPath(`/${user.id}/telegram`),
                activeSessionId: null,
                permissions,
                tokens: null,
                stats: {},
                lifecycle: "active",
                createdAt: 1,
                updatedAt: 1
            });
            await harness.storage.agents.create({
                id: "user-agent-2",
                userId: user.id,
                type: "user",
                descriptor: { type: "user", connector: "whatsapp", userId: "conn", channelId: "chan-2" },
                path: agentPath(`/${user.id}/whatsapp`),
                activeSessionId: null,
                permissions,
                tokens: null,
                stats: {},
                lifecycle: "active",
                createdAt: 2,
                updatedAt: 2
            });
            await harness.storage.agents.create({
                id: "subagent-1",
                userId: user.id,
                type: "subagent",
                descriptor: { type: "subagent", id: "subagent-1", parentAgentId: "parent", name: "worker" },
                path: agentPath(`/${user.id}/agent/worker/sub/0`),
                activeSessionId: null,
                permissions,
                tokens: null,
                stats: {},
                lifecycle: "active",
                createdAt: 3,
                updatedAt: 3
            });

            const item: AgentInboxItem = {
                type: "system_message",
                text: "<system_message>hello</system_message>"
            };
            const post = vi.spyOn(harness.agentSystem, "post").mockResolvedValue();

            await harness.agentSystem.postToUserAgents(user.id, item);

            expect(post).toHaveBeenCalledTimes(2);
            expect(post).toHaveBeenCalledWith(
                expect.objectContaining({ userId: user.id, agentId: "user-agent-1" }),
                { agentId: "user-agent-1" },
                item
            );
            expect(post).toHaveBeenCalledWith(
                expect.objectContaining({ userId: user.id, agentId: "user-agent-2" }),
                { agentId: "user-agent-2" },
                item
            );
        } finally {
            await rm(dir, { recursive: true, force: true });
        }
    });

    it("refreshes sandboxes only for loaded agents of the target user", async () => {
        const dir = await mkdtemp(path.join(os.tmpdir(), "daycare-agent-system-"));
        try {
            const harness = await harnessCreate(dir);
            await harness.agentSystem.load();
            await harness.agentSystem.start();

            const firstDescriptor: AgentLegacyDescriptor = {
                type: "user",
                connector: "telegram",
                userId: "connector-a",
                channelId: "channel-a"
            };
            const secondDescriptor: AgentLegacyDescriptor = {
                type: "user",
                connector: "telegram",
                userId: "connector-b",
                channelId: "channel-b"
            };
            await postAndAwait(harness.agentSystem, { descriptor: firstDescriptor }, { type: "reset", message: "a" });
            await postAndAwait(harness.agentSystem, { descriptor: secondDescriptor }, { type: "reset", message: "b" });
            const firstAgentId = await agentIdForTarget(harness.agentSystem, { descriptor: firstDescriptor });
            const secondAgentId = await agentIdForTarget(harness.agentSystem, { descriptor: secondDescriptor });
            const entries = (
                harness.agentSystem as unknown as {
                    entries: Map<string, { ctx: Context; agent: { sandboxRefresh: () => void } }>;
                }
            ).entries;
            const firstEntry = entries.get(firstAgentId);
            const secondEntry = entries.get(secondAgentId);
            if (!firstEntry || !secondEntry) {
                throw new Error("Expected loaded entries");
            }
            const firstSpy = vi.spyOn(firstEntry.agent, "sandboxRefresh");
            const secondSpy = vi.spyOn(secondEntry.agent, "sandboxRefresh");

            const refreshed = harness.agentSystem.refreshSandboxesForUserId(firstEntry.ctx.userId);

            expect(refreshed).toBe(1);
            expect(firstSpy).toHaveBeenCalledTimes(1);
            expect(secondSpy).toHaveBeenCalledTimes(0);
        } finally {
            await rm(dir, { recursive: true, force: true });
        }
    });
});

async function harnessCreate(
    dir: string,
    options?: { inferenceRouter?: InferenceRouter }
): Promise<{
    config: ReturnType<typeof configResolve>;
    storage: Storage;
    eventBus: EngineEventBus;
    signals: Signals;
    delayedSignals: DelayedSignals;
    agentSystem: AgentSystem;
}> {
    const config = configResolve(
        {
            engine: { dataDir: dir },
            providers: [{ id: "openai", model: "gpt-4.1" }]
        },
        path.join(dir, "settings.json")
    );
    const configModule = new ConfigModule(config);
    const storage = await storageOpen(config.db.path);
    const eventBus = new EngineEventBus();
    const signals = new Signals({
        eventBus,
        observationLog: storage.observationLog,
        signalEvents: storage.signalEvents,
        signalSubscriptions: storage.signalSubscriptions
    });
    const delayedSignals = new DelayedSignals({
        config: configModule,
        eventBus,
        signals,
        delayedSignals: storage.delayedSignals
    });
    await delayedSignals.ensureDir();
    const pluginManager = {
        getSystemPrompts: async () => [],
        listRegisteredSkills: () => []
    } as unknown as PluginManager;
    const inferenceRouter =
        options?.inferenceRouter ??
        ({
            complete: vi.fn(async () => inferenceResponse("ok"))
        } as unknown as InferenceRouter);
    const agentSystem = new AgentSystem({
        config: configModule,
        eventBus,
        storage,
        connectorRegistry: new ConnectorRegistry({
            onMessage: async () => undefined
        }),
        imageRegistry: new ImageGenerationRegistry(),
        mediaRegistry: new MediaAnalysisRegistry(),
        toolResolver: new ToolResolver(),
        pluginManager,
        inferenceRouter,
        authStore: new AuthStore(config),
        delayedSignals
    });
    agentSystem.setCrons({
        listTasks: async () => []
    } as unknown as Crons);
    agentSystem.setWebhooks({} as Parameters<AgentSystem["setWebhooks"]>[0]);
    agentSystem.setSignals(signals);
    return { config, storage, eventBus, signals, delayedSignals, agentSystem };
}

async function subagentCreate(agentSystem: AgentSystem, eventBus: EngineEventBus): Promise<string> {
    let createdAgentId: string | null = null;
    const unsubscribe = eventBus.onEvent((event) => {
        if (event.type !== "agent.created") {
            return;
        }
        const payload = event.payload as { agentId?: string };
        if (payload.agentId) {
            createdAgentId = payload.agentId;
        }
    });
    try {
        const parentDescriptor: AgentLegacyDescriptor = {
            type: "cron",
            id: createId(),
            name: `parent-${createId()}`
        };
        await postAndAwait(agentSystem, { descriptor: parentDescriptor }, { type: "reset", message: "init parent" });
        const parentAgentId = await agentIdForTarget(agentSystem, { descriptor: parentDescriptor });
        const subagentPath = await agentPathChildAllocate({
            storage: agentSystem.storage,
            parentAgentId,
            kind: "sub"
        });
        await postAndAwait(agentSystem, { path: subagentPath }, { type: "reset", message: "init subagent" });
    } finally {
        unsubscribe();
    }
    if (!createdAgentId) {
        throw new Error("Subagent create did not emit agent.created");
    }
    return createdAgentId;
}

function inferenceResponse(text: string) {
    return {
        providerId: "openai",
        modelId: "gpt-4.1",
        message: {
            role: "assistant" as const,
            content: [{ type: "text" as const, text }],
            api: "openai-responses" as const,
            provider: "openai",
            model: "gpt-4.1",
            usage: {
                input: 10,
                output: 5,
                cacheRead: 0,
                cacheWrite: 0,
                totalTokens: 15,
                cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 }
            },
            stopReason: "stop" as const,
            timestamp: Date.now()
        }
    };
}

async function postAndAwait(
    agentSystem: AgentSystem,
    ctxOrTarget: Context | AgentTargetInput,
    targetOrItem: AgentTargetInput | AgentInboxItem,
    maybeItem?: AgentInboxItem
): Promise<AgentInboxResult> {
    if (maybeItem) {
        const normalizedTarget = targetNormalize(targetOrItem as AgentTargetInput, ctxOrTarget as Context);
        return agentSystem.postAndAwait(
            ctxOrTarget as Context,
            normalizedTarget,
            maybeItem,
            creationConfigResolve(targetOrItem as AgentTargetInput, ctxOrTarget as Context)
        );
    }
    const target = ctxOrTarget as AgentTargetInput;
    const ctx = await callerCtxResolve(agentSystem, target);
    const normalizedTarget = targetNormalize(target, ctx);
    return agentSystem.postAndAwait(
        ctx,
        normalizedTarget,
        targetOrItem as AgentInboxItem,
        creationConfigResolve(target, ctx)
    );
}

async function post(
    agentSystem: AgentSystem,
    ctxOrTarget: Context | AgentTargetInput,
    targetOrItem: AgentTargetInput | AgentInboxItem,
    maybeItem?: AgentInboxItem
): Promise<void> {
    if (maybeItem) {
        const normalizedTarget = targetNormalize(targetOrItem as AgentTargetInput, ctxOrTarget as Context);
        await agentSystem.post(
            ctxOrTarget as Context,
            normalizedTarget,
            maybeItem,
            creationConfigResolve(targetOrItem as AgentTargetInput, ctxOrTarget as Context)
        );
        return;
    }
    const target = ctxOrTarget as AgentTargetInput;
    const ctx = await callerCtxResolve(agentSystem, target);
    const normalizedTarget = targetNormalize(target, ctx);
    await agentSystem.post(ctx, normalizedTarget, targetOrItem as AgentInboxItem, creationConfigResolve(target, ctx));
}

async function agentIdForTarget(
    agentSystem: AgentSystem,
    ctxOrTarget: Context | AgentTargetInput,
    maybeTarget?: AgentTargetInput
): Promise<string> {
    if (maybeTarget) {
        const normalizedTarget = targetNormalize(maybeTarget, ctxOrTarget as Context);
        return agentSystem.agentIdForTarget(
            ctxOrTarget as Context,
            normalizedTarget,
            creationConfigResolve(maybeTarget, ctxOrTarget as Context)
        );
    }
    const target = ctxOrTarget as AgentTargetInput;
    const ctx = await callerCtxResolve(agentSystem, target);
    const normalizedTarget = targetNormalize(target, ctx);
    return agentSystem.agentIdForTarget(ctx, normalizedTarget, creationConfigResolve(target, ctx));
}

type AgentTargetInput = AgentPostTarget | { descriptor: AgentLegacyDescriptor };

async function callerCtxResolve(agentSystem: AgentSystem, target: AgentTargetInput): Promise<Context> {
    if ("agentId" in target) {
        const targetCtx = await agentSystem.contextForAgentId(target.agentId);
        if (!targetCtx) {
            throw new Error(`Agent not found: ${target.agentId}`);
        }
        return contextForUser({ userId: targetCtx.userId });
    }
    if ("path" in target) {
        const userId = pathUserIdResolve(target.path);
        if (userId) {
            return contextForUser({ userId });
        }
        return agentSystem.ownerCtxEnsure();
    }
    if (target.descriptor.type === "user") {
        const user = await agentSystem.storage.resolveUserByConnectorKey(
            userConnectorKeyCreate(target.descriptor.connector, target.descriptor.userId)
        );
        return contextForUser({ userId: user.id });
    }
    if (target.descriptor.type === "swarm") {
        return contextForUser({ userId: target.descriptor.id });
    }
    return agentSystem.ownerCtxEnsure();
}

function targetNormalize(target: AgentTargetInput, ctx: Context): AgentPostTarget {
    if ("agentId" in target || "path" in target) {
        return target;
    }
    return { path: agentPathFromLegacyDescriptor(target.descriptor, { userId: ctx.userId }) };
}

function creationConfigResolve(target: AgentTargetInput, ctx: Context): AgentCreationConfig | undefined {
    if ("agentId" in target) {
        return undefined;
    }
    if ("path" in target) {
        return creationConfigFromPath(target.path);
    }
    const config = agentCreationConfigFromLegacyDescriptor(target.descriptor);
    if ((config.kind === "sub" || config.kind === "search" || config.kind === "memory") && !config.parentAgentId) {
        config.parentAgentId = ctx.agentId ?? null;
    }
    return config;
}

function pathUserIdResolve(path: AgentPath): string | null {
    const segments = String(path)
        .split("/")
        .filter((segment) => segment.length > 0);
    const first = segments[0]?.trim() ?? "";
    if (!first || first === "system") {
        return null;
    }
    return first;
}

function creationConfigFromPath(path: AgentPath): AgentCreationConfig {
    const segments = String(path)
        .split("/")
        .filter((segment) => segment.length > 0);
    if (segments[0] === "system") {
        return { kind: "system", name: segments[1] ?? null };
    }
    if (segments[1] === "agent" && segments[2] === "swarm") {
        return { kind: "swarm", foreground: true, name: "swarm" };
    }
    if (segments[1] === "agent") {
        if (segments.at(-2) === "sub") {
            return { kind: "sub", name: "subagent" };
        }
        if (segments.at(-2) === "search") {
            return { kind: "search", name: "memory-search" };
        }
        return { kind: "agent" };
    }
    if (segments[1] === "sub" || segments.at(-2) === "sub") {
        return { kind: "sub", name: "subagent" };
    }
    if (segments[1] === "search" || segments.at(-2) === "search") {
        return { kind: "search", name: "memory-search" };
    }
    if (segments[1] === "memory" || segments.at(-1) === "memory") {
        return { kind: "memory", name: "memory-agent" };
    }
    if (segments[1] === "cron") {
        return { kind: "cron", name: segments[2] ?? null };
    }
    if (segments[1] === "task") {
        return { kind: "task", name: segments[2] ?? null };
    }
    if (segments[1] === "subuser") {
        return { kind: "subuser", name: segments[2] ?? null };
    }
    return {
        kind: "connector",
        foreground: true,
        connectorName: segments[1] ?? null
    };
}

async function contextForAgentIdRequire(agentSystem: AgentSystem, agentId: string): Promise<Context> {
    const ctx = await agentSystem.contextForAgentId(agentId);
    if (!ctx) {
        throw new Error(`Agent not found: ${agentId}`);
    }
    return ctx;
}
