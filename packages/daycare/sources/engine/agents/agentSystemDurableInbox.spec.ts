import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createId } from "@paralleldrive/cuid2";
import { describe, expect, it, vi } from "vitest";
import type {
    AgentDescriptor,
    AgentHistoryRecord,
    AgentInboxItem,
    AgentInboxResult,
    AgentPostTarget,
    Context
} from "@/types";
import { AuthStore } from "../../auth/store.js";
import { configResolve } from "../../config/configResolve.js";
import type { Storage } from "../../storage/storage.js";
import { storageOpenTest } from "../../storage/storageOpenTest.js";
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
import { Signals } from "../signals/signals.js";
import { AgentSystem } from "./agentSystem.js";
import { contextForUser } from "./context.js";
import { agentHistoryLoad } from "./ops/agentHistoryLoad.js";
import { agentStateRead } from "./ops/agentStateRead.js";
import { agentStateWrite } from "./ops/agentStateWrite.js";
import { inboxItemDeserialize } from "./ops/inboxItemDeserialize.js";

describe("AgentSystem durable inboxes", () => {
    it("persists queued entries and merges consecutive messages into one durable row", async () => {
        const dir = await mkdtemp(path.join(os.tmpdir(), "daycare-agent-system-inbox-"));
        try {
            const harness = await harnessCreate(dir);
            await harness.agentSystem.load();

            const descriptor: AgentDescriptor = { type: "cron", id: createId(), name: "durable-merge" };
            await post(
                harness.agentSystem,
                { descriptor },
                { type: "message", message: { text: "first" }, context: { messageId: "m-1" } }
            );
            await post(
                harness.agentSystem,
                { descriptor },
                { type: "message", message: { text: "second" }, context: { messageId: "m-2" } }
            );
            const agentId = await agentIdForTarget(harness.agentSystem, { descriptor });
            const rows = await harness.storage.inbox.findByAgentId(agentId);

            expect(rows).toHaveLength(1);
            const item = inboxItemDeserialize(rows[0]?.data ?? "");
            if (item.type !== "message") {
                throw new Error("Expected durable message item");
            }
            expect(item.message.text).toBe("first\nsecond");
            expect(item.context).toEqual({ messageId: "m-2" });
        } finally {
            await dirRemove(dir);
        }
    });

    it("deletes durable rows after inbox items are processed", async () => {
        const dir = await mkdtemp(path.join(os.tmpdir(), "daycare-agent-system-inbox-"));
        try {
            const harness = await harnessCreate(dir);
            await harness.agentSystem.load();
            await harness.agentSystem.start();

            const descriptor: AgentDescriptor = { type: "cron", id: createId(), name: "durable-delete" };
            await postAndAwait(harness.agentSystem, { descriptor }, { type: "reset", message: "seed" });
            const agentId = await agentIdForTarget(harness.agentSystem, { descriptor });
            const rows = await harness.storage.inbox.findByAgentId(agentId);

            expect(rows).toEqual([]);
        } finally {
            await dirRemove(dir);
        }
    });

    it("replays persisted rows after restart and then cleans them up", async () => {
        const dir = await mkdtemp(path.join(os.tmpdir(), "daycare-agent-system-inbox-"));
        const sharedStorage = await storageOpenTest();
        try {
            const first = await harnessCreate(dir, { storage: sharedStorage });
            await first.agentSystem.load();
            const descriptor: AgentDescriptor = { type: "cron", id: createId(), name: "durable-replay" };
            await post(
                first.agentSystem,
                { descriptor },
                { type: "message", message: { text: "replay-me" }, context: { messageId: "m-replay" } }
            );
            const agentId = await agentIdForTarget(first.agentSystem, { descriptor });
            const beforeRestart = await first.storage.inbox.findByAgentId(agentId);
            expect(beforeRestart).toHaveLength(1);
            const second = await harnessCreate(dir, {
                storage: sharedStorage,
                inferenceRouter: {
                    complete: vi.fn(async () => inferenceResponse("ok"))
                } as unknown as InferenceRouter
            });
            await second.agentSystem.load();
            await second.agentSystem.start();
            await vi.waitFor(
                async () => {
                    const afterReplay = await second.storage.inbox.findByAgentId(agentId);
                    expect(afterReplay).toEqual([]);
                },
                { timeout: 20_000, interval: 100 }
            );
        } finally {
            await dirRemove(dir);
        }
    });

    it("drops stale in-flight durable row and continues inference after pending rlm recovery", async () => {
        const dir = await mkdtemp(path.join(os.tmpdir(), "daycare-agent-system-inbox-"));
        const sharedStorage = await storageOpenTest();
        try {
            const first = await harnessCreate(dir, {
                storage: sharedStorage,
                inferenceRouter: {
                    complete: vi.fn(async () => inferenceResponse("unexpected-replay"))
                } as unknown as InferenceRouter
            });
            await first.agentSystem.load();
            await first.agentSystem.start();
            const descriptor: AgentDescriptor = { type: "cron", id: createId(), name: "durable-pending-recovery" };
            await postAndAwait(first.agentSystem, { descriptor }, { type: "reset", message: "seed" });
            const agentId = await agentIdForTarget(first.agentSystem, { descriptor });
            const startedAt = Date.now();
            await first.storage.appendHistory(agentId, {
                type: "user_message",
                at: startedAt - 2,
                text: "wait for one minute",
                files: []
            });
            await first.storage.appendHistory(agentId, {
                type: "assistant_message",
                at: startedAt - 1,
                tokens: null,
                content: [{ type: "toolCall", id: "run-1", name: "run_python", arguments: { code: "wait(60)" } }]
            });
            await first.storage.appendHistory(agentId, {
                type: "rlm_start",
                at: startedAt,
                toolCallId: "run-1",
                code: "wait(60)",
                preamble: "preamble"
            });
            await first.storage.inbox.insert(
                "inflight-row",
                agentId,
                startedAt + 1,
                "message",
                JSON.stringify({
                    type: "message",
                    message: { text: "wait for one minute" },
                    context: { messageId: "m-wait" }
                })
            );
            const firstCtx = await contextForAgentIdRequire(first.agentSystem, agentId);
            const firstState = await agentStateRead(first.storage, firstCtx);
            if (!firstState) {
                throw new Error("Expected persisted state for pending recovery test");
            }
            await agentStateWrite(first.storage, firstCtx, {
                ...firstState,
                state: "active",
                updatedAt: Date.now()
            });

            const complete = vi.fn(async () => inferenceResponse("unexpected-replay"));
            const second = await harnessCreate(dir, {
                storage: sharedStorage,
                inferenceRouter: {
                    complete
                } as unknown as InferenceRouter
            });
            await second.agentSystem.load();
            await second.agentSystem.start();

            await vi.waitFor(async () => {
                const rows = await second.storage.inbox.findByAgentId(agentId);
                expect(rows).toEqual([]);
            });
            const ctx = await contextForAgentIdRequire(second.agentSystem, agentId);
            await vi.waitFor(async () => {
                const history = await agentHistoryLoad(second.storage, ctx);
                expect(
                    history.some(
                        (record) => record.type === "rlm_complete" && record.toolCallId === "run-1" && record.isError
                    )
                ).toBe(true);
            });

            const history = await agentHistoryLoad(second.storage, ctx);
            const userMessages = history.filter(
                (record): record is Extract<AgentHistoryRecord, { type: "user_message" }> =>
                    record.type === "user_message"
            );
            expect(userMessages.filter((record) => record.text === "wait for one minute")).toHaveLength(1);
            await vi.waitFor(async () => {
                expect(complete).toHaveBeenCalledTimes(1);
            });
        } finally {
            await dirRemove(dir);
        }
    });

    it("clears durable rows when a loaded subagent is killed by poison-pill", async () => {
        const dir = await mkdtemp(path.join(os.tmpdir(), "daycare-agent-system-inbox-"));
        try {
            const harness = await harnessCreate(dir);
            await harness.agentSystem.load();
            await harness.agentSystem.start();

            const agentId = await subagentCreate(harness.agentSystem, harness.eventBus);
            await harness.storage.inbox.insert(
                `inbox-${agentId}`,
                agentId,
                Date.now(),
                "reset",
                JSON.stringify({ type: "reset", message: "pending" })
            );
            await harness.signals.generate({
                type: `agent:${agentId}:poison-pill`,
                source: { type: "system", userId: "user-1" }
            });

            await vi.waitFor(async () => {
                const state = await agentStateRead(
                    harness.storage,
                    await contextForAgentIdRequire(harness.agentSystem, agentId)
                );
                expect(state?.state).toBe("dead");
            });
            await vi.waitFor(async () => {
                const rows = await harness.storage.inbox.findByAgentId(agentId);
                expect(rows).toEqual([]);
            });
        } finally {
            await dirRemove(dir);
        }
    });

    it("clears durable rows when an unloaded sleeping subagent is killed by poison-pill", async () => {
        const dir = await mkdtemp(path.join(os.tmpdir(), "daycare-agent-system-inbox-"));
        const sharedStorage = await storageOpenTest();
        try {
            const first = await harnessCreate(dir, { storage: sharedStorage });
            await first.agentSystem.load();
            await first.agentSystem.start();
            const agentId = await subagentCreate(first.agentSystem, first.eventBus);
            await first.storage.inbox.insert(
                `inbox-${agentId}`,
                agentId,
                Date.now(),
                "reset",
                JSON.stringify({ type: "reset", message: "pending" })
            );

            const second = await harnessCreate(dir, { storage: sharedStorage });
            await second.agentSystem.load();
            await second.agentSystem.start();
            await second.signals.generate({
                type: `agent:${agentId}:poison-pill`,
                source: { type: "system", userId: "user-1" }
            });

            await vi.waitFor(async () => {
                const state = await agentStateRead(
                    second.storage,
                    await contextForAgentIdRequire(second.agentSystem, agentId)
                );
                expect(state?.state).toBe("dead");
            });
            await vi.waitFor(async () => {
                const rows = await second.storage.inbox.findByAgentId(agentId);
                expect(rows).toEqual([]);
            });
        } finally {
            await dirRemove(dir);
        }
    });
});

async function harnessCreate(
    dir: string,
    options?: { inferenceRouter?: InferenceRouter; storage?: Storage }
): Promise<{
    config: ReturnType<typeof configResolve>;
    storage: Storage;
    eventBus: EngineEventBus;
    signals: Signals;
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
    const storage = options?.storage ?? (await storageOpenTest());
    const eventBus = new EngineEventBus();
    const signals = new Signals({
        eventBus,
        observationLog: storage.observationLog,
        signalEvents: storage.signalEvents,
        signalSubscriptions: storage.signalSubscriptions
    });
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
        authStore: new AuthStore(config)
    });
    agentSystem.setCrons({
        listTasks: async () => []
    } as unknown as Crons);
    agentSystem.setWebhooks({} as Parameters<AgentSystem["setWebhooks"]>[0]);
    agentSystem.setSignals(signals);
    return { config, storage, eventBus, signals, agentSystem };
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
        const parentDescriptor: AgentDescriptor = {
            type: "cron",
            id: createId(),
            name: `parent-${createId()}`
        };
        await postAndAwait(agentSystem, { descriptor: parentDescriptor }, { type: "reset", message: "init parent" });
        const parentAgentId = await agentIdForTarget(agentSystem, { descriptor: parentDescriptor });
        const descriptor: AgentDescriptor = {
            type: "subagent",
            id: createId(),
            parentAgentId,
            name: `subagent-${createId()}`
        };
        await postAndAwait(agentSystem, { descriptor }, { type: "reset", message: "init subagent" });
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
    ctxOrTarget: Context | AgentPostTarget,
    targetOrItem: AgentPostTarget | AgentInboxItem,
    maybeItem?: AgentInboxItem
): Promise<AgentInboxResult> {
    if (maybeItem) {
        return agentSystem.postAndAwait(ctxOrTarget as Context, targetOrItem as AgentPostTarget, maybeItem);
    }
    const target = ctxOrTarget as AgentPostTarget;
    return agentSystem.postAndAwait(
        await callerCtxResolve(agentSystem, target),
        target,
        targetOrItem as AgentInboxItem
    );
}

async function post(
    agentSystem: AgentSystem,
    ctxOrTarget: Context | AgentPostTarget,
    targetOrItem: AgentPostTarget | AgentInboxItem,
    maybeItem?: AgentInboxItem
): Promise<void> {
    if (maybeItem) {
        await agentSystem.post(ctxOrTarget as Context, targetOrItem as AgentPostTarget, maybeItem);
        return;
    }
    const target = ctxOrTarget as AgentPostTarget;
    await agentSystem.post(await callerCtxResolve(agentSystem, target), target, targetOrItem as AgentInboxItem);
}

async function agentIdForTarget(
    agentSystem: AgentSystem,
    ctxOrTarget: Context | AgentPostTarget,
    maybeTarget?: AgentPostTarget
): Promise<string> {
    if (maybeTarget) {
        return agentSystem.agentIdForTarget(ctxOrTarget as Context, maybeTarget);
    }
    const target = ctxOrTarget as AgentPostTarget;
    return agentSystem.agentIdForTarget(await callerCtxResolve(agentSystem, target), target);
}

async function callerCtxResolve(agentSystem: AgentSystem, target: AgentPostTarget): Promise<Context> {
    if ("agentId" in target) {
        const targetCtx = await agentSystem.contextForAgentId(target.agentId);
        if (!targetCtx) {
            throw new Error(`Agent not found: ${target.agentId}`);
        }
        return contextForUser({ userId: targetCtx.userId });
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

async function contextForAgentIdRequire(agentSystem: AgentSystem, agentId: string): Promise<Context> {
    const ctx = await agentSystem.contextForAgentId(agentId);
    if (!ctx) {
        throw new Error(`Agent not found: ${agentId}`);
    }
    return ctx;
}

async function dirRemove(dir: string): Promise<void> {
    for (let attempt = 0; attempt < 10; attempt += 1) {
        try {
            await rm(dir, { recursive: true, force: true });
            return;
        } catch (error) {
            if (!dirRemoveRetryable(error) || attempt === 9) {
                throw error;
            }
            await new Promise((resolve) => setTimeout(resolve, (attempt + 1) * 25));
        }
    }
}

function dirRemoveRetryable(error: unknown): boolean {
    if (!(error instanceof Error)) {
        return false;
    }
    const code = (error as NodeJS.ErrnoException).code;
    return code === "ENOTEMPTY" || code === "EBUSY";
}
