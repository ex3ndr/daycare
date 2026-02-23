import { mkdtemp, readdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { createId } from "@paralleldrive/cuid2";
import { describe, expect, it, vi } from "vitest";
import type {
    AgentDescriptor,
    AgentInboxItem,
    AgentInboxResult,
    AgentPostTarget,
    AgentState,
    Connector,
    Context,
    Signal
} from "@/types";
import { AuthStore } from "../../auth/store.js";
import { configResolve } from "../../config/configResolve.js";
import { userConnectorKeyCreate } from "../../storage/userConnectorKeyCreate.js";
import { ConfigModule } from "../config/configModule.js";
import type { Crons } from "../cron/crons.js";
import { EngineEventBus } from "../ipc/events.js";
import { ConnectorRegistry } from "../modules/connectorRegistry.js";
import { ImageGenerationRegistry } from "../modules/imageGenerationRegistry.js";
import type { InferenceRouter } from "../modules/inference/router.js";
import { ToolResolver } from "../modules/toolResolver.js";
import type { PluginManager } from "../plugins/manager.js";
import { DelayedSignals } from "../signals/delayedSignals.js";
import { Signals } from "../signals/signals.js";
import { UserHome } from "../users/userHome.js";
import { Agent } from "./agent.js";
import { AgentSystem } from "./agentSystem.js";
import { contextForUser } from "./context.js";
import { agentDescriptorRead } from "./ops/agentDescriptorRead.js";
import { agentHistoryLoad } from "./ops/agentHistoryLoad.js";
import { agentHistoryLoadAll } from "./ops/agentHistoryLoadAll.js";
import { AgentInbox } from "./ops/agentInbox.js";
import { agentStateRead } from "./ops/agentStateRead.js";

describe("Agent", () => {
    it("persists descriptor, state, and history on create", async () => {
        const dir = await mkdtemp(path.join(os.tmpdir(), "daycare-agent-"));
        try {
            const config = configResolve({ engine: { dataDir: dir } }, path.join(dir, "settings.json"));
            const agentSystem = new AgentSystem({
                config: new ConfigModule(config),
                eventBus: new EngineEventBus(),
                connectorRegistry: new ConnectorRegistry({
                    onMessage: async () => undefined
                }),
                imageRegistry: new ImageGenerationRegistry(),
                toolResolver: new ToolResolver(),
                pluginManager: {} as unknown as PluginManager,
                inferenceRouter: {} as unknown as InferenceRouter,
                authStore: new AuthStore(config)
            });
            agentSystem.setCrons({} as unknown as Crons);

            const agentId = createId();
            const descriptor: AgentDescriptor = {
                type: "user",
                connector: "slack",
                channelId: "channel-1",
                userId: "user-1"
            };
            const userId = createId();
            const userHome = agentSystem.userHomeForUserId(userId);
            await Agent.create(agentId, descriptor, userId, new AgentInbox(agentId), agentSystem, userHome);

            const restoredDescriptor = await agentDescriptorRead(config, agentId);
            expect(restoredDescriptor).toEqual(descriptor);

            const state = await agentStateRead(config, agentId);
            if (!state) {
                throw new Error("State not found");
            }
            expect(state.permissions.workingDir).toBe(userHome.desktop);
            expect(state?.activeSessionId).toBeTruthy();

            const history = await agentHistoryLoad(config, agentId);
            expect(history).toEqual([]);
        } finally {
            await rm(dir, { recursive: true, force: true });
        }
    });

    it("sends reset confirmation from agent for user resets with context", async () => {
        const dir = await mkdtemp(path.join(os.tmpdir(), "daycare-agent-"));
        try {
            const config = configResolve({ engine: { dataDir: dir } }, path.join(dir, "settings.json"));
            const connectorRegistry = new ConnectorRegistry({
                onMessage: async () => undefined
            });
            const sendMessage = vi.fn(async () => undefined);
            const connector: Connector = {
                capabilities: { sendText: true },
                onMessage: () => () => undefined,
                sendMessage
            };
            const registerResult = connectorRegistry.register("telegram", connector);
            expect(registerResult).toEqual({ ok: true, status: "loaded" });

            const agentSystem = new AgentSystem({
                config: new ConfigModule(config),
                eventBus: new EngineEventBus(),
                connectorRegistry,
                imageRegistry: new ImageGenerationRegistry(),
                toolResolver: new ToolResolver(),
                pluginManager: {} as unknown as PluginManager,
                inferenceRouter: {} as unknown as InferenceRouter,
                authStore: new AuthStore(config)
            });
            agentSystem.setCrons({} as unknown as Crons);
            await agentSystem.load();
            await agentSystem.start();

            const descriptor: AgentDescriptor = {
                type: "user",
                connector: "telegram",
                channelId: "channel-1",
                userId: "user-1"
            };
            const result = await postAndAwait(
                agentSystem,
                { descriptor },
                {
                    type: "reset",
                    message: "Manual reset requested by the user.",
                    context: { messageId: "42" }
                }
            );

            expect(result).toEqual({ type: "reset", ok: true });
            expect(sendMessage).toHaveBeenCalledWith("channel-1", {
                text: "🔄 Session reset.",
                replyToMessageId: "42"
            });

            await connectorRegistry.unregisterAll("test");
        } finally {
            await rm(dir, { recursive: true, force: true });
        }
    });

    it("rotates inference session id on reset", async () => {
        const dir = await mkdtemp(path.join(os.tmpdir(), "daycare-agent-"));
        try {
            const config = configResolve({ engine: { dataDir: dir } }, path.join(dir, "settings.json"));
            const agentSystem = new AgentSystem({
                config: new ConfigModule(config),
                eventBus: new EngineEventBus(),
                connectorRegistry: new ConnectorRegistry({
                    onMessage: async () => undefined
                }),
                imageRegistry: new ImageGenerationRegistry(),
                toolResolver: new ToolResolver(),
                pluginManager: {} as unknown as PluginManager,
                inferenceRouter: {} as unknown as InferenceRouter,
                authStore: new AuthStore(config)
            });
            agentSystem.setCrons({} as unknown as Crons);
            await agentSystem.load();
            await agentSystem.start();

            const descriptor: AgentDescriptor = {
                type: "cron",
                id: createId(),
                name: "Reset Session Agent"
            };
            await postAndAwait(agentSystem, { descriptor }, { type: "reset", message: "first reset" });
            const agentId = await agentIdForTarget(agentSystem, { descriptor });
            const firstState = await agentStateRead(config, agentId);
            expect(firstState?.inferenceSessionId).toBeTruthy();

            await postAndAwait(agentSystem, { agentId }, { type: "reset", message: "second reset" });
            const secondState = await agentStateRead(config, agentId);
            expect(secondState?.inferenceSessionId).toBeTruthy();
            expect(secondState?.inferenceSessionId).not.toBe(firstState?.inferenceSessionId);
        } finally {
            await rm(dir, { recursive: true, force: true });
        }
    });

    it("passes executable system messages through unchanged when rlm is disabled", async () => {
        const dir = await mkdtemp(path.join(os.tmpdir(), "daycare-agent-execute-"));
        try {
            const config = configResolve(
                {
                    engine: { dataDir: dir },
                    providers: [{ id: "openai", model: "gpt-4.1" }]
                },
                path.join(dir, "settings.json")
            );
            const agentSystem = new AgentSystem({
                config: new ConfigModule(config),
                eventBus: new EngineEventBus(),
                connectorRegistry: new ConnectorRegistry({
                    onMessage: async () => undefined
                }),
                imageRegistry: new ImageGenerationRegistry(),
                toolResolver: new ToolResolver(),
                pluginManager: pluginManagerStubBuild(),
                inferenceRouter: inferenceRouterStubBuild(),
                authStore: new AuthStore(config)
            });
            agentSystem.setCrons({ listTasks: async () => [] } as unknown as Crons);
            agentSystem.setHeartbeats({} as Parameters<AgentSystem["setHeartbeats"]>[0]);
            await agentSystem.load();
            await agentSystem.start();

            const descriptor: AgentDescriptor = {
                type: "cron",
                id: createId(),
                name: "Executable prompt cron"
            };
            await postAndAwait(
                agentSystem,
                { descriptor },
                {
                    type: "system_message",
                    text: "Check: <run_python>1 + 1</run_python>",
                    origin: "cron",
                    execute: true
                }
            );

            const agentId = await agentIdForTarget(agentSystem, { descriptor });
            const history = await agentHistoryLoadAll(config, agentId);
            const userRecord = history.find((record) => record.type === "user_message");
            if (!userRecord || userRecord.type !== "user_message") {
                throw new Error("Expected user_message history record");
            }
            expect(userRecord.text).toContain("<run_python>1 + 1</run_python>");
        } finally {
            await rm(dir, { recursive: true, force: true });
        }
    });

    it("expands executable system messages when rlm is enabled", async () => {
        const dir = await mkdtemp(path.join(os.tmpdir(), "daycare-agent-execute-"));
        try {
            const config = configResolve(
                {
                    engine: { dataDir: dir },
                    providers: [{ id: "openai", model: "gpt-4.1" }],
                    features: { rlm: true }
                },
                path.join(dir, "settings.json")
            );
            const agentSystem = new AgentSystem({
                config: new ConfigModule(config),
                eventBus: new EngineEventBus(),
                connectorRegistry: new ConnectorRegistry({
                    onMessage: async () => undefined
                }),
                imageRegistry: new ImageGenerationRegistry(),
                toolResolver: new ToolResolver(),
                pluginManager: pluginManagerStubBuild(),
                inferenceRouter: inferenceRouterStubBuild(),
                authStore: new AuthStore(config)
            });
            agentSystem.setCrons({ listTasks: async () => [] } as unknown as Crons);
            agentSystem.setHeartbeats({} as Parameters<AgentSystem["setHeartbeats"]>[0]);
            await agentSystem.load();
            await agentSystem.start();

            const descriptor: AgentDescriptor = {
                type: "cron",
                id: createId(),
                name: "Executable prompt cron"
            };
            await postAndAwait(
                agentSystem,
                { descriptor },
                {
                    type: "system_message",
                    text: "Check: <run_python>1 + 1</run_python>",
                    origin: "cron",
                    execute: true
                }
            );

            const agentId = await agentIdForTarget(agentSystem, { descriptor });
            const history = await agentHistoryLoadAll(config, agentId);
            const userRecord = history.find((record) => record.type === "user_message");
            if (!userRecord || userRecord.type !== "user_message") {
                throw new Error("Expected user_message history record");
            }
            expect(userRecord.text).toContain("Check: 2");
            expect(userRecord.text).not.toContain("<run_python>");
        } finally {
            await rm(dir, { recursive: true, force: true });
        }
    });

    it("injects exec_error blocks when executable system message expansion fails", async () => {
        const dir = await mkdtemp(path.join(os.tmpdir(), "daycare-agent-execute-"));
        try {
            const config = configResolve(
                {
                    engine: { dataDir: dir },
                    providers: [{ id: "openai", model: "gpt-4.1" }],
                    features: { rlm: true }
                },
                path.join(dir, "settings.json")
            );
            const agentSystem = new AgentSystem({
                config: new ConfigModule(config),
                eventBus: new EngineEventBus(),
                connectorRegistry: new ConnectorRegistry({
                    onMessage: async () => undefined
                }),
                imageRegistry: new ImageGenerationRegistry(),
                toolResolver: new ToolResolver(),
                pluginManager: pluginManagerStubBuild(),
                inferenceRouter: inferenceRouterStubBuild(),
                authStore: new AuthStore(config)
            });
            agentSystem.setCrons({ listTasks: async () => [] } as unknown as Crons);
            agentSystem.setHeartbeats({} as Parameters<AgentSystem["setHeartbeats"]>[0]);
            await agentSystem.load();
            await agentSystem.start();

            const descriptor: AgentDescriptor = {
                type: "cron",
                id: createId(),
                name: "Executable prompt cron"
            };
            await postAndAwait(
                agentSystem,
                { descriptor },
                {
                    type: "system_message",
                    text: "Check: <run_python>def broken(</run_python>",
                    origin: "cron",
                    execute: true
                }
            );

            const agentId = await agentIdForTarget(agentSystem, { descriptor });
            const history = await agentHistoryLoadAll(config, agentId);
            const userRecord = history.find((record) => record.type === "user_message");
            if (!userRecord || userRecord.type !== "user_message") {
                throw new Error("Expected user_message history record");
            }
            expect(userRecord.text).toContain("<exec_error>");
            expect(userRecord.text).not.toContain("<run_python>");
        } finally {
            await rm(dir, { recursive: true, force: true });
        }
    });

    it("shows typing and writes compaction logs for manual compaction", async () => {
        const dir = await mkdtemp(path.join(os.tmpdir(), "daycare-agent-"));
        try {
            const config = configResolve(
                {
                    engine: { dataDir: dir },
                    providers: [{ id: "openai", model: "gpt-4.1" }]
                },
                path.join(dir, "settings.json")
            );
            const connectorRegistry = new ConnectorRegistry({
                onMessage: async () => undefined
            });
            const sendMessage = vi.fn(async () => undefined);
            const stopTyping = vi.fn(() => undefined);
            const startTyping = vi.fn(() => stopTyping);
            const connector: Connector = {
                capabilities: { sendText: true, typing: true },
                onMessage: () => () => undefined,
                sendMessage,
                startTyping
            };
            const registerResult = connectorRegistry.register("telegram", connector);
            expect(registerResult).toEqual({ ok: true, status: "loaded" });

            let receivedSessionId: string | undefined;
            const complete = vi.fn(async (_context: unknown, sessionId: string) => {
                receivedSessionId = sessionId;
                return {
                    providerId: "openai",
                    modelId: "gpt-4.1",
                    message: {
                        role: "assistant",
                        content: [{ type: "text", text: "Compacted summary" }],
                        api: "openai-responses",
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
                        stopReason: "stop",
                        timestamp: Date.now()
                    }
                };
            });
            const inferenceRouter: InferenceRouter = {
                complete
            } as unknown as InferenceRouter;

            const agentSystem = new AgentSystem({
                config: new ConfigModule(config),
                eventBus: new EngineEventBus(),
                connectorRegistry,
                imageRegistry: new ImageGenerationRegistry(),
                toolResolver: new ToolResolver(),
                pluginManager: {} as unknown as PluginManager,
                inferenceRouter,
                authStore: new AuthStore(config)
            });
            agentSystem.setCrons({} as unknown as Crons);
            await agentSystem.load();
            await agentSystem.start();

            const descriptor: AgentDescriptor = {
                type: "user",
                connector: "telegram",
                channelId: "channel-1",
                userId: "user-1"
            };

            await postAndAwait(agentSystem, { descriptor }, { type: "reset", message: "seed context" });
            const agentId = await agentIdForTarget(agentSystem, { descriptor });
            const beforeCompaction = await agentStateRead(config, agentId);
            expect(beforeCompaction?.inferenceSessionId).toBeTruthy();
            const result = await postAndAwait(
                agentSystem,
                { descriptor },
                { type: "compact", context: { messageId: "88" } }
            );

            expect(result).toEqual({ type: "compact", ok: true });
            expect(complete).toHaveBeenCalledTimes(1);
            expect(receivedSessionId).toBe(beforeCompaction?.inferenceSessionId);
            expect(startTyping).toHaveBeenCalledWith("channel-1");
            expect(stopTyping).toHaveBeenCalledTimes(1);
            expect(sendMessage).toHaveBeenLastCalledWith("channel-1", {
                text: "Session compacted.",
                replyToMessageId: "88"
            });

            const state = await agentStateRead(config, agentId);
            expect(state?.activeSessionId).toBeTruthy();
            expect(state?.activeSessionId).not.toBe(beforeCompaction?.activeSessionId);
            const history = await agentHistoryLoad(config, agentId);
            const firstHistoryRecord = history[0];
            expect(firstHistoryRecord?.type).toBe("user_message");
            if (!firstHistoryRecord || firstHistoryRecord.type !== "user_message") {
                throw new Error("Expected user_message in compacted session history.");
            }
            expect(firstHistoryRecord.text).toContain("Compacted summary");
            const files = await readdir(path.join(config.agentsDir, agentId));
            expect(files.some((file) => file.startsWith("compaction_") && file.endsWith(".md"))).toBe(true);

            await connectorRegistry.unregisterAll("test");
        } finally {
            await rm(dir, { recursive: true, force: true });
        }
    });

    it("reports empty compaction summaries without changing context", async () => {
        const dir = await mkdtemp(path.join(os.tmpdir(), "daycare-agent-"));
        try {
            const config = configResolve(
                {
                    engine: { dataDir: dir },
                    providers: [{ id: "openai", model: "gpt-4.1" }]
                },
                path.join(dir, "settings.json")
            );
            const connectorRegistry = new ConnectorRegistry({
                onMessage: async () => undefined
            });
            const sendMessage = vi.fn(async () => undefined);
            const connector: Connector = {
                capabilities: { sendText: true, typing: true },
                onMessage: () => () => undefined,
                sendMessage,
                startTyping: () => () => undefined
            };
            const registerResult = connectorRegistry.register("telegram", connector);
            expect(registerResult).toEqual({ ok: true, status: "loaded" });

            const inferenceRouter: InferenceRouter = {
                complete: vi.fn(async () => ({
                    providerId: "openai",
                    modelId: "gpt-4.1",
                    message: {
                        role: "assistant",
                        content: [{ type: "text", text: "   " }],
                        api: "openai-responses",
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
                        stopReason: "stop",
                        timestamp: Date.now()
                    }
                }))
            } as unknown as InferenceRouter;

            const agentSystem = new AgentSystem({
                config: new ConfigModule(config),
                eventBus: new EngineEventBus(),
                connectorRegistry,
                imageRegistry: new ImageGenerationRegistry(),
                toolResolver: new ToolResolver(),
                pluginManager: {} as unknown as PluginManager,
                inferenceRouter,
                authStore: new AuthStore(config)
            });
            agentSystem.setCrons({} as unknown as Crons);
            await agentSystem.load();
            await agentSystem.start();

            const descriptor: AgentDescriptor = {
                type: "user",
                connector: "telegram",
                channelId: "channel-1",
                userId: "user-1"
            };

            await postAndAwait(agentSystem, { descriptor }, { type: "reset", message: "seed context" });
            const result = await postAndAwait(
                agentSystem,
                { descriptor },
                { type: "compact", context: { messageId: "89" } }
            );

            expect(result).toEqual({ type: "compact", ok: false });
            expect(sendMessage).toHaveBeenLastCalledWith("channel-1", {
                text: "Compaction produced an empty summary; context unchanged.",
                replyToMessageId: "89"
            });

            await connectorRegistry.unregisterAll("test");
        } finally {
            await rm(dir, { recursive: true, force: true });
        }
    });

    it("drops queued signals after unsubscribe before agent handles inbox", async () => {
        const dir = await mkdtemp(path.join(os.tmpdir(), "daycare-agent-"));
        try {
            const config = configResolve({ engine: { dataDir: dir } }, path.join(dir, "settings.json"));
            const eventBus = new EngineEventBus();
            const agentSystem = new AgentSystem({
                config: new ConfigModule(config),
                eventBus,
                connectorRegistry: new ConnectorRegistry({
                    onMessage: async () => undefined
                }),
                imageRegistry: new ImageGenerationRegistry(),
                toolResolver: new ToolResolver(),
                pluginManager: {} as unknown as PluginManager,
                inferenceRouter: {} as unknown as InferenceRouter,
                authStore: new AuthStore(config)
            });
            agentSystem.setCrons({} as unknown as Crons);
            const signals = new Signals({
                eventBus,
                configDir: config.configDir,
                onDeliver: async (signal, subscriptions) => {
                    await agentSystem.signalDeliver(signal, subscriptions);
                }
            });
            agentSystem.setSignals(signals);
            await agentSystem.load();

            const agentId = createId();
            const descriptor: AgentDescriptor = { type: "cron", id: agentId, name: "Signal agent" };
            await post(agentSystem, { descriptor }, { type: "reset", message: "init" });
            const ctx = await agentSystem.contextForAgentId(agentId);
            if (!ctx) {
                throw new Error("Missing agent context");
            }
            await signals.subscribe({
                ctx: { userId: ctx.userId, agentId },
                pattern: "build:*:done",
                silent: true
            });
            await signals.generate({ type: "build:alpha:done", source: { type: "system", userId: ctx.userId } });
            await signals.unsubscribe({ ctx: { userId: ctx.userId, agentId }, pattern: "build:*:done" });

            await agentSystem.start();
            await postAndAwait(agentSystem, { agentId }, { type: "reset", message: "flush queue" });

            const history = await agentHistoryLoad(config, agentId);
            expect(historyHasSignalText(history)).toBe(false);
        } finally {
            await rm(dir, { recursive: true, force: true });
        }
    });

    it("delivers queued signal when subscribed at handling time", async () => {
        const dir = await mkdtemp(path.join(os.tmpdir(), "daycare-agent-"));
        try {
            const config = configResolve({ engine: { dataDir: dir } }, path.join(dir, "settings.json"));
            const eventBus = new EngineEventBus();
            const agentSystem = new AgentSystem({
                config: new ConfigModule(config),
                eventBus,
                connectorRegistry: new ConnectorRegistry({
                    onMessage: async () => undefined
                }),
                imageRegistry: new ImageGenerationRegistry(),
                toolResolver: new ToolResolver(),
                pluginManager: {} as unknown as PluginManager,
                inferenceRouter: {} as unknown as InferenceRouter,
                authStore: new AuthStore(config)
            });
            agentSystem.setCrons({} as unknown as Crons);
            const signals = new Signals({
                eventBus,
                configDir: config.configDir,
                onDeliver: async (signal, subscriptions) => {
                    await agentSystem.signalDeliver(signal, subscriptions);
                }
            });
            agentSystem.setSignals(signals);
            await agentSystem.load();

            const agentId = createId();
            const descriptor: AgentDescriptor = { type: "cron", id: agentId, name: "Signal agent" };
            await post(agentSystem, { descriptor }, { type: "reset", message: "init" });
            const ctx = await agentSystem.contextForAgentId(agentId);
            if (!ctx) {
                throw new Error("Missing agent context");
            }
            await signals.subscribe({
                ctx: { userId: ctx.userId, agentId },
                pattern: "build:*:done",
                silent: true
            });
            await signals.generate({ type: "build:alpha:done", source: { type: "system", userId: ctx.userId } });
            await signals.unsubscribe({ ctx: { userId: ctx.userId, agentId }, pattern: "build:*:done" });
            await signals.subscribe({
                ctx: { userId: ctx.userId, agentId },
                pattern: "build:*:done",
                silent: true
            });

            await agentSystem.start();
            await postAndAwait(agentSystem, { agentId }, { type: "reset", message: "flush queue" });

            const history = await agentHistoryLoadAll(config, agentId);
            expect(historyHasSignalText(history)).toBe(true);
        } finally {
            await rm(dir, { recursive: true, force: true });
        }
    });

    it("does not deliver agent-sourced signals back to the same agent", async () => {
        const dir = await mkdtemp(path.join(os.tmpdir(), "daycare-agent-"));
        try {
            const config = configResolve({ engine: { dataDir: dir } }, path.join(dir, "settings.json"));
            const eventBus = new EngineEventBus();
            const agentSystem = new AgentSystem({
                config: new ConfigModule(config),
                eventBus,
                connectorRegistry: new ConnectorRegistry({
                    onMessage: async () => undefined
                }),
                imageRegistry: new ImageGenerationRegistry(),
                toolResolver: new ToolResolver(),
                pluginManager: {} as unknown as PluginManager,
                inferenceRouter: {} as unknown as InferenceRouter,
                authStore: new AuthStore(config)
            });
            agentSystem.setCrons({} as unknown as Crons);
            const signals = new Signals({
                eventBus,
                configDir: config.configDir,
                onDeliver: async (signal, subscriptions) => {
                    await agentSystem.signalDeliver(signal, subscriptions);
                }
            });
            agentSystem.setSignals(signals);
            await agentSystem.load();

            const sourceAgentId = createId();
            const peerAgentId = createId();
            await post(
                agentSystem,
                { descriptor: { type: "cron", id: sourceAgentId, name: "Source agent" } },
                { type: "reset", message: "init source" }
            );
            await post(
                agentSystem,
                { descriptor: { type: "cron", id: peerAgentId, name: "Peer agent" } },
                { type: "reset", message: "init peer" }
            );

            const sourceCtx = await agentSystem.contextForAgentId(sourceAgentId);
            const peerCtx = await agentSystem.contextForAgentId(peerAgentId);
            if (!sourceCtx || !peerCtx) {
                throw new Error("Missing signal test agent contexts");
            }
            await signals.subscribe({
                ctx: { userId: sourceCtx.userId, agentId: sourceAgentId },
                pattern: "build:*:done",
                silent: true
            });
            await signals.subscribe({
                ctx: { userId: peerCtx.userId, agentId: peerAgentId },
                pattern: "build:*:done",
                silent: true
            });
            await signals.generate({
                type: "build:alpha:done",
                source: {
                    type: "agent",
                    id: sourceAgentId,
                    userId: sourceCtx.userId
                }
            });

            await agentSystem.start();
            await postAndAwait(
                agentSystem,
                { agentId: sourceAgentId },
                { type: "reset", message: "flush source queue" }
            );
            await postAndAwait(agentSystem, { agentId: peerAgentId }, { type: "reset", message: "flush peer queue" });

            const sourceHistory = await agentHistoryLoadAll(config, sourceAgentId);
            expect(historyHasSignalText(sourceHistory)).toBe(false);

            const peerHistory = await agentHistoryLoadAll(config, peerAgentId);
            expect(historyHasSignalText(peerHistory)).toBe(true);
        } finally {
            await rm(dir, { recursive: true, force: true });
        }
    });

    it("emits wake and sleep lifecycle signals", async () => {
        const dir = await mkdtemp(path.join(os.tmpdir(), "daycare-agent-"));
        try {
            const config = configResolve({ engine: { dataDir: dir } }, path.join(dir, "settings.json"));
            const eventBus = new EngineEventBus();
            const agentSystem = new AgentSystem({
                config: new ConfigModule(config),
                eventBus,
                connectorRegistry: new ConnectorRegistry({
                    onMessage: async () => undefined
                }),
                imageRegistry: new ImageGenerationRegistry(),
                toolResolver: new ToolResolver(),
                pluginManager: {} as unknown as PluginManager,
                inferenceRouter: {} as unknown as InferenceRouter,
                authStore: new AuthStore(config)
            });
            agentSystem.setCrons({} as unknown as Crons);
            const signals = new Signals({ eventBus, configDir: config.configDir });
            agentSystem.setSignals(signals);
            await agentSystem.load();
            await agentSystem.start();

            const lifecycleTypes: string[] = [];
            const unsubscribe = eventBus.onEvent((event) => {
                if (event.type !== "signal.generated") {
                    return;
                }
                const payload = event.payload as Signal;
                if (!payload.type.startsWith("agent:")) {
                    return;
                }
                lifecycleTypes.push(payload.type);
            });

            const agentId = createId();
            const descriptor: AgentDescriptor = { type: "cron", id: agentId, name: "Lifecycle agent" };

            await postAndAwait(agentSystem, { descriptor }, { type: "reset", message: "init lifecycle" });
            await postAndAwait(agentSystem, { agentId }, { type: "reset", message: "wake lifecycle" });

            unsubscribe();

            expect(lifecycleTypes).toContain(`agent:${agentId}:sleep`);
            expect(lifecycleTypes).toContain(`agent:${agentId}:wake`);
        } finally {
            await rm(dir, { recursive: true, force: true });
        }
    });

    it("emits idle lifecycle signal one minute after sleeping", async () => {
        vi.useFakeTimers();
        const dir = await mkdtemp(path.join(os.tmpdir(), "daycare-agent-"));
        let delayedSignals: DelayedSignals | null = null;
        try {
            const config = configResolve({ engine: { dataDir: dir } }, path.join(dir, "settings.json"));
            const eventBus = new EngineEventBus();
            const configModule = new ConfigModule(config);
            const signals = new Signals({ eventBus, configDir: config.configDir });
            delayedSignals = new DelayedSignals({ config: configModule, eventBus, signals });
            const agentSystem = new AgentSystem({
                config: configModule,
                eventBus,
                connectorRegistry: new ConnectorRegistry({
                    onMessage: async () => undefined
                }),
                imageRegistry: new ImageGenerationRegistry(),
                toolResolver: new ToolResolver(),
                pluginManager: {} as unknown as PluginManager,
                inferenceRouter: {} as unknown as InferenceRouter,
                authStore: new AuthStore(config),
                delayedSignals
            });
            agentSystem.setCrons({} as unknown as Crons);
            agentSystem.setSignals(signals);
            await delayedSignals.start();
            await agentSystem.load();
            await agentSystem.start();

            const lifecycleTypes: string[] = [];
            const unsubscribe = eventBus.onEvent((event) => {
                if (event.type !== "signal.generated") {
                    return;
                }
                const payload = event.payload as Signal;
                lifecycleTypes.push(payload.type);
            });

            const agentId = createId();
            const descriptor: AgentDescriptor = { type: "cron", id: agentId, name: "Idle agent" };

            await postAndAwait(agentSystem, { descriptor }, { type: "reset", message: "init idle lifecycle" });

            await vi.advanceTimersByTimeAsync(59_000);
            expect(lifecycleTypes).not.toContain(`agent:${agentId}:idle`);

            await vi.advanceTimersByTimeAsync(1_000);
            await vi.waitFor(() => {
                expect(lifecycleTypes).toContain(`agent:${agentId}:idle`);
            });

            unsubscribe();
        } finally {
            delayedSignals?.stop();
            vi.useRealTimers();
            await rm(dir, { recursive: true, force: true });
        }
    });

    it("cancels pending idle lifecycle signal when agent wakes", async () => {
        vi.useFakeTimers();
        const dir = await mkdtemp(path.join(os.tmpdir(), "daycare-agent-"));
        let delayedSignals: DelayedSignals | null = null;
        try {
            const config = configResolve({ engine: { dataDir: dir } }, path.join(dir, "settings.json"));
            const eventBus = new EngineEventBus();
            const configModule = new ConfigModule(config);
            const signals = new Signals({ eventBus, configDir: config.configDir });
            delayedSignals = new DelayedSignals({ config: configModule, eventBus, signals });
            const agentSystem = new AgentSystem({
                config: configModule,
                eventBus,
                connectorRegistry: new ConnectorRegistry({
                    onMessage: async () => undefined
                }),
                imageRegistry: new ImageGenerationRegistry(),
                toolResolver: new ToolResolver(),
                pluginManager: {} as unknown as PluginManager,
                inferenceRouter: {} as unknown as InferenceRouter,
                authStore: new AuthStore(config),
                delayedSignals
            });
            agentSystem.setCrons({} as unknown as Crons);
            agentSystem.setSignals(signals);
            await delayedSignals.start();
            await agentSystem.load();
            await agentSystem.start();

            const agentId = createId();
            const descriptor: AgentDescriptor = { type: "cron", id: agentId, name: "Wake cancel agent" };

            await postAndAwait(agentSystem, { descriptor }, { type: "reset", message: "initial sleep" });
            const signalType = `agent:${agentId}:idle`;
            const firstIdle = delayedSignals.list().find((entry) => entry.type === signalType);
            expect(firstIdle).toBeTruthy();
            const firstDeliverAt = firstIdle?.deliverAt ?? 0;

            await vi.advanceTimersByTimeAsync(30_000);

            await postAndAwait(agentSystem, { agentId }, { type: "reset", message: "wake before idle deadline" });

            const idleSignals = delayedSignals.list().filter((entry) => entry.type === signalType);
            expect(idleSignals).toHaveLength(1);
            expect((idleSignals[0]?.deliverAt ?? 0) > firstDeliverAt).toBe(true);
        } finally {
            delayedSignals?.stop();
            vi.useRealTimers();
            await rm(dir, { recursive: true, force: true });
        }
    });

    it("rebuilds permissions from userHome on restore, discarding stale persisted paths", async () => {
        const dir = await mkdtemp(path.join(os.tmpdir(), "daycare-agent-"));
        try {
            const config = configResolve({ engine: { dataDir: dir } }, path.join(dir, "settings.json"));
            const agentSystem = new AgentSystem({
                config: new ConfigModule(config),
                eventBus: new EngineEventBus(),
                connectorRegistry: new ConnectorRegistry({
                    onMessage: async () => undefined
                }),
                imageRegistry: new ImageGenerationRegistry(),
                toolResolver: new ToolResolver(),
                pluginManager: {} as unknown as PluginManager,
                inferenceRouter: {} as unknown as InferenceRouter,
                authStore: new AuthStore(config)
            });
            agentSystem.setCrons({} as unknown as Crons);

            const agentId = createId();
            const userId = createId();
            const userHome = new UserHome(config.usersDir, userId);
            const descriptor: AgentDescriptor = {
                type: "user",
                connector: "slack",
                channelId: "ch-1",
                userId: "u-1"
            };
            const staleState: AgentState = {
                context: { messages: [] },
                activeSessionId: null,
                permissions: {
                    workingDir: "/stale/legacy/workspace",
                    writeDirs: ["/stale/old/dir"]
                },
                tokens: null,
                stats: {},
                createdAt: Date.now(),
                updatedAt: Date.now(),
                state: "active"
            };

            const agent = Agent.restore(
                agentId,
                userId,
                descriptor,
                staleState,
                new AgentInbox(agentId),
                agentSystem,
                userHome
            );

            expect(agent.state.permissions.workingDir).toBe(userHome.desktop);
            expect(agent.state.permissions.writeDirs).toEqual([userHome.home]);
        } finally {
            await rm(dir, { recursive: true, force: true });
        }
    });

    it("uses permanent agent workspaceDir as workingDir on restore", async () => {
        const dir = await mkdtemp(path.join(os.tmpdir(), "daycare-agent-"));
        try {
            const config = configResolve({ engine: { dataDir: dir } }, path.join(dir, "settings.json"));
            const agentSystem = new AgentSystem({
                config: new ConfigModule(config),
                eventBus: new EngineEventBus(),
                connectorRegistry: new ConnectorRegistry({
                    onMessage: async () => undefined
                }),
                imageRegistry: new ImageGenerationRegistry(),
                toolResolver: new ToolResolver(),
                pluginManager: {} as unknown as PluginManager,
                inferenceRouter: {} as unknown as InferenceRouter,
                authStore: new AuthStore(config)
            });
            agentSystem.setCrons({} as unknown as Crons);

            const agentId = createId();
            const userId = createId();
            const userHome = new UserHome(config.usersDir, userId);
            const workspaceDir = path.join(userHome.home, "custom-workspace");
            const descriptor: AgentDescriptor = {
                type: "permanent",
                id: agentId,
                name: "test-perm",
                description: "test",
                systemPrompt: "test",
                workspaceDir
            };
            const staleState: AgentState = {
                context: { messages: [] },
                activeSessionId: null,
                permissions: {
                    workingDir: "/stale/legacy/workspace",
                    writeDirs: ["/stale/old/dir"]
                },
                tokens: null,
                stats: {},
                createdAt: Date.now(),
                updatedAt: Date.now(),
                state: "active"
            };

            const agent = Agent.restore(
                agentId,
                userId,
                descriptor,
                staleState,
                new AgentInbox(agentId),
                agentSystem,
                userHome
            );

            expect(agent.state.permissions.workingDir).toBe(workspaceDir);
            expect(agent.state.permissions.writeDirs).toEqual([userHome.home]);
        } finally {
            await rm(dir, { recursive: true, force: true });
        }
    });
});

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
    if (target.descriptor.type === "subuser") {
        return contextForUser({ userId: target.descriptor.id });
    }
    return agentSystem.ownerCtxEnsure();
}

function historyHasSignalText(records: Array<{ type: string; text?: string }>): boolean {
    return records.some(
        (record) =>
            record.type === "user_message" && typeof record.text === "string" && record.text.includes("[signal]")
    );
}

function inferenceRouterStubBuild(): InferenceRouter {
    return {
        complete: vi.fn(async () => ({
            providerId: "openai",
            modelId: "gpt-4.1",
            message: {
                role: "assistant",
                content: [{ type: "text", text: "ok" }],
                api: "openai-responses",
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
                stopReason: "stop",
                timestamp: Date.now()
            }
        }))
    } as unknown as InferenceRouter;
}

function pluginManagerStubBuild(): PluginManager {
    return {
        listRegisteredSkills: vi.fn(() => [])
    } as unknown as PluginManager;
}
