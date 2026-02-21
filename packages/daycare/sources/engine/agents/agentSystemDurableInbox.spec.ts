import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createId } from "@paralleldrive/cuid2";
import { describe, expect, it, vi } from "vitest";
import type { AgentDescriptor } from "@/types";
import { AuthStore } from "../../auth/store.js";
import { configResolve } from "../../config/configResolve.js";
import { Storage } from "../../storage/storage.js";
import { ConfigModule } from "../config/configModule.js";
import type { Crons } from "../cron/crons.js";
import type { Heartbeats } from "../heartbeat/heartbeats.js";
import { EngineEventBus } from "../ipc/events.js";
import { ConnectorRegistry } from "../modules/connectorRegistry.js";
import { ImageGenerationRegistry } from "../modules/imageGenerationRegistry.js";
import type { InferenceRouter } from "../modules/inference/router.js";
import { ToolResolver } from "../modules/toolResolver.js";
import type { PluginManager } from "../plugins/manager.js";
import { Signals } from "../signals/signals.js";
import { AgentSystem } from "./agentSystem.js";
import { agentStateRead } from "./ops/agentStateRead.js";
import { inboxItemDeserialize } from "./ops/inboxItemDeserialize.js";

describe("AgentSystem durable inboxes", () => {
    it("persists queued entries and merges consecutive messages into one durable row", async () => {
        const dir = await mkdtemp(path.join(os.tmpdir(), "daycare-agent-system-inbox-"));
        try {
            const harness = await harnessCreate(dir);
            await harness.agentSystem.load();

            const descriptor: AgentDescriptor = { type: "cron", id: createId(), name: "durable-merge" };
            await harness.agentSystem.post(
                { descriptor },
                { type: "message", message: { text: "first" }, context: { messageId: "m-1" } }
            );
            await harness.agentSystem.post(
                { descriptor },
                { type: "message", message: { text: "second" }, context: { messageId: "m-2" } }
            );
            const agentId = await harness.agentSystem.agentIdForTarget({ descriptor });
            const rows = await harness.storage.inbox.findByAgentId(agentId);

            expect(rows).toHaveLength(1);
            const item = inboxItemDeserialize(rows[0]?.data ?? "");
            if (item.type !== "message") {
                throw new Error("Expected durable message item");
            }
            expect(item.message.text).toBe("first\nsecond");
            expect(item.context).toEqual({ messageId: "m-2" });
        } finally {
            await rm(dir, { recursive: true, force: true });
        }
    });

    it("deletes durable rows after inbox items are processed", async () => {
        const dir = await mkdtemp(path.join(os.tmpdir(), "daycare-agent-system-inbox-"));
        try {
            const harness = await harnessCreate(dir);
            await harness.agentSystem.load();
            await harness.agentSystem.start();

            const descriptor: AgentDescriptor = { type: "cron", id: createId(), name: "durable-delete" };
            await harness.agentSystem.postAndAwait({ descriptor }, { type: "reset", message: "seed" });
            const agentId = await harness.agentSystem.agentIdForTarget({ descriptor });
            const rows = await harness.storage.inbox.findByAgentId(agentId);

            expect(rows).toEqual([]);
        } finally {
            await rm(dir, { recursive: true, force: true });
        }
    });

    it("replays persisted rows after restart and then cleans them up", async () => {
        const dir = await mkdtemp(path.join(os.tmpdir(), "daycare-agent-system-inbox-"));
        try {
            const first = await harnessCreate(dir);
            await first.agentSystem.load();
            const descriptor: AgentDescriptor = { type: "cron", id: createId(), name: "durable-replay" };
            await first.agentSystem.post(
                { descriptor },
                { type: "message", message: { text: "replay-me" }, context: { messageId: "m-replay" } }
            );
            const agentId = await first.agentSystem.agentIdForTarget({ descriptor });
            const beforeRestart = await first.storage.inbox.findByAgentId(agentId);
            expect(beforeRestart).toHaveLength(1);
            const second = await harnessCreate(dir, {
                inferenceRouter: {
                    complete: vi.fn(async () => inferenceResponse("ok"))
                } as unknown as InferenceRouter
            });
            await second.agentSystem.load();
            await second.agentSystem.start();
            await vi.waitFor(async () => {
                const afterReplay = await second.storage.inbox.findByAgentId(agentId);
                expect(afterReplay).toEqual([]);
            });
        } finally {
            await rm(dir, { recursive: true, force: true });
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
                const state = await agentStateRead(harness.storage, agentId);
                expect(state?.state).toBe("dead");
            });
            await vi.waitFor(async () => {
                const rows = await harness.storage.inbox.findByAgentId(agentId);
                expect(rows).toEqual([]);
            });
        } finally {
            await rm(dir, { recursive: true, force: true });
        }
    });

    it("clears durable rows when an unloaded sleeping subagent is killed by poison-pill", async () => {
        const dir = await mkdtemp(path.join(os.tmpdir(), "daycare-agent-system-inbox-"));
        try {
            const first = await harnessCreate(dir);
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

            const second = await harnessCreate(dir);
            await second.agentSystem.load();
            await second.agentSystem.start();
            await second.signals.generate({
                type: `agent:${agentId}:poison-pill`,
                source: { type: "system", userId: "user-1" }
            });

            await vi.waitFor(async () => {
                const state = await agentStateRead(second.storage, agentId);
                expect(state?.state).toBe("dead");
            });
            await vi.waitFor(async () => {
                const rows = await second.storage.inbox.findByAgentId(agentId);
                expect(rows).toEqual([]);
            });
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
    const storage = Storage.open(config.dbPath);
    const eventBus = new EngineEventBus();
    const signals = new Signals({ eventBus, configDir: config.configDir });
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
        toolResolver: new ToolResolver(),
        pluginManager,
        inferenceRouter,
        authStore: new AuthStore(config)
    });
    agentSystem.setCrons({
        listTasks: async () => []
    } as unknown as Crons);
    agentSystem.setHeartbeats({} as unknown as Heartbeats);
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
        const descriptor: AgentDescriptor = {
            type: "subagent",
            id: createId(),
            parentAgentId: createId(),
            name: `subagent-${createId()}`
        };
        await agentSystem.postAndAwait({ descriptor }, { type: "reset", message: "init subagent" });
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
            content: [{ type: "text" as const, text: `<response>${text}</response>` }],
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
