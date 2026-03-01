import { mkdtemp, readdir, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { Tool } from "@mariozechner/pi-ai";
import { createId } from "@paralleldrive/cuid2";
import { Type } from "@sinclair/typebox";
import { describe, expect, it, vi } from "vitest";
import type {
    AgentDescriptor,
    AgentHistoryRecord,
    AgentInboxItem,
    AgentInboxResult,
    AgentPostTarget,
    AgentState,
    Connector,
    Context,
    Signal,
    SignalSubscription
} from "@/types";
import { AuthStore } from "../../auth/store.js";
import { configResolve } from "../../config/configResolve.js";
import { sessionHistoryTable } from "../../schema.js";
import { storageOpen } from "../../storage/storageOpen.js";
import { storageOpenTest } from "../../storage/storageOpenTest.js";
import { userConnectorKeyCreate } from "../../storage/userConnectorKeyCreate.js";
import { ConfigModule } from "../config/configModule.js";
import type { Crons } from "../cron/crons.js";
import { EngineEventBus } from "../ipc/events.js";
import { ConnectorRegistry } from "../modules/connectorRegistry.js";
import { ImageGenerationRegistry } from "../modules/imageGenerationRegistry.js";
import type { InferenceRouter } from "../modules/inference/router.js";
import { MediaAnalysisRegistry } from "../modules/mediaAnalysisRegistry.js";
import { montyPreambleBuild } from "../modules/monty/montyPreambleBuild.js";
import { RLM_LIMITS } from "../modules/rlm/rlmLimits.js";
import { rlmSnapshotSave } from "../modules/rlm/rlmSnapshotSave.js";
import { rlmStepStart } from "../modules/rlm/rlmStepStart.js";
import { ToolResolver } from "../modules/toolResolver.js";
import type { PluginManager } from "../plugins/manager.js";
import { DelayedSignals } from "../signals/delayedSignals.js";
import { Signals } from "../signals/signals.js";
import { UserHome } from "../users/userHome.js";
import { Agent } from "./agent.js";
import { AgentSystem } from "./agentSystem.js";
import { contextForAgent, contextForUser } from "./context.js";
import { agentDescriptorRead } from "./ops/agentDescriptorRead.js";
import { agentHistoryLoad } from "./ops/agentHistoryLoad.js";
import { agentHistoryLoadAll } from "./ops/agentHistoryLoadAll.js";
import { AgentInbox } from "./ops/agentInbox.js";
import { agentPathMemory } from "./ops/agentPathBuild.js";
import { agentPathFromDescriptor } from "./ops/agentPathFromDescriptor.js";
import { agentPathUserId } from "./ops/agentPathParse.js";
import { agentStateRead } from "./ops/agentStateRead.js";

describe("Agent", () => {
    it("persists descriptor, state, and history on create", async () => {
        const dir = await mkdtemp(path.join(os.tmpdir(), "daycare-agent-"));
        try {
            const config = configResolve({ engine: { dataDir: dir } }, path.join(dir, "settings.json"));
            const agentSystem = new AgentSystem({
                config: new ConfigModule(config),
                eventBus: new EngineEventBus(),
                storage: await storageOpenTest(),
                connectorRegistry: new ConnectorRegistry({
                    onMessage: async () => undefined
                }),
                imageRegistry: new ImageGenerationRegistry(),
                mediaRegistry: new MediaAnalysisRegistry(),
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
            const ctx = contextForAgent({ userId, agentId });
            await Agent.create(ctx, descriptor, new AgentInbox(agentId), agentSystem, userHome);

            const restoredDescriptor = await agentDescriptorRead(agentSystem.storage, ctx);
            expect(restoredDescriptor).toEqual(descriptor);

            const state = await agentStateRead(agentSystem.storage, ctx);
            if (!state) {
                throw new Error("State not found");
            }
            expect(state.permissions.workingDir).toBe(userHome.desktop);
            expect(state?.activeSessionId).toBeTruthy();

            const history = await agentHistoryLoad(agentSystem.storage, ctx);
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
                storage: await storageOpen(config.db.path),
                connectorRegistry,
                imageRegistry: new ImageGenerationRegistry(),
                mediaRegistry: new MediaAnalysisRegistry(),
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
            expect(sendMessage).toHaveBeenCalledWith("user-1", {
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
                storage: await storageOpenTest(),
                connectorRegistry: new ConnectorRegistry({
                    onMessage: async () => undefined
                }),
                imageRegistry: new ImageGenerationRegistry(),
                mediaRegistry: new MediaAnalysisRegistry(),
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
            const firstState = await agentStateRead(
                agentSystem.storage,
                await contextForAgentIdRequire(agentSystem, agentId)
            );
            expect(firstState?.inferenceSessionId).toBeTruthy();

            await postAndAwait(agentSystem, { agentId }, { type: "reset", message: "second reset" });
            const secondState = await agentStateRead(
                agentSystem.storage,
                await contextForAgentIdRequire(agentSystem, agentId)
            );
            expect(secondState?.inferenceSessionId).toBeTruthy();
            expect(secondState?.inferenceSessionId).not.toBe(firstState?.inferenceSessionId);
        } finally {
            await rm(dir, { recursive: true, force: true });
        }
    });

    it("executes system messages when code is present", async () => {
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
                storage: await storageOpen(config.db.path),
                connectorRegistry: new ConnectorRegistry({
                    onMessage: async () => undefined
                }),
                imageRegistry: new ImageGenerationRegistry(),
                mediaRegistry: new MediaAnalysisRegistry(),
                toolResolver: new ToolResolver(),
                pluginManager: pluginManagerStubBuild(),
                inferenceRouter: inferenceRouterStubBuild(),
                authStore: new AuthStore(config)
            });
            agentSystem.setCrons({ listTasks: async () => [] } as unknown as Crons);
            agentSystem.setWebhooks({} as Parameters<AgentSystem["setWebhooks"]>[0]);
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
                    text: "Check:",
                    code: "1 + 1",
                    origin: "cron"
                }
            );

            const agentId = await agentIdForTarget(agentSystem, { descriptor });
            const history = await agentHistoryLoadAll(
                agentSystem.storage,
                await contextForAgentIdRequire(agentSystem, agentId)
            );
            const userRecord = history.find((record) => record.type === "user_message");
            if (!userRecord || userRecord.type !== "user_message") {
                throw new Error("Expected user_message history record");
            }
            expect(userRecord.text).toContain("Check:");
            expect(userRecord.text).toContain("2");
        } finally {
            await rm(dir, { recursive: true, force: true });
        }
    });

    it("injects exec_error blocks when executable system message code fails", async () => {
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
                storage: await storageOpen(config.db.path),
                connectorRegistry: new ConnectorRegistry({
                    onMessage: async () => undefined
                }),
                imageRegistry: new ImageGenerationRegistry(),
                mediaRegistry: new MediaAnalysisRegistry(),
                toolResolver: new ToolResolver(),
                pluginManager: pluginManagerStubBuild(),
                inferenceRouter: inferenceRouterStubBuild(),
                authStore: new AuthStore(config)
            });
            agentSystem.setCrons({ listTasks: async () => [] } as unknown as Crons);
            agentSystem.setWebhooks({} as Parameters<AgentSystem["setWebhooks"]>[0]);
            await agentSystem.load();
            await agentSystem.start();

            const descriptor: AgentDescriptor = {
                type: "cron",
                id: createId(),
                name: "Executable prompt cron"
            };
            const result = await postAndAwait(
                agentSystem,
                { descriptor },
                {
                    type: "system_message",
                    text: "Check:",
                    code: "def broken(",
                    origin: "cron"
                }
            );
            if (result.type !== "system_message") {
                throw new Error("Expected system_message result");
            }
            expect(result.responseError).toBe(true);

            const agentId = await agentIdForTarget(agentSystem, { descriptor });
            const history = await agentHistoryLoadAll(
                agentSystem.storage,
                await contextForAgentIdRequire(agentSystem, agentId)
            );
            const userRecord = history.find((record) => record.type === "user_message");
            if (!userRecord || userRecord.type !== "user_message") {
                throw new Error("Expected user_message history record");
            }
            expect(userRecord.text).toContain("<exec_error>");
            const starts = history.filter(
                (record): record is Extract<AgentHistoryRecord, { type: "rlm_start" }> => record.type === "rlm_start"
            );
            const completes = history.filter(
                (record): record is Extract<AgentHistoryRecord, { type: "rlm_complete" }> =>
                    record.type === "rlm_complete"
            );
            expect(starts).toHaveLength(1);
            expect(completes).toHaveLength(1);
            expect(completes[0]?.isError).toBe(true);
            expect(completes[0]?.error && completes[0].error.length > 0).toBe(true);
            expect(completes[0]?.toolCallId).toBe(starts[0]?.toolCallId);
        } finally {
            await rm(dir, { recursive: true, force: true });
        }
    });

    it("runs inference after task-referenced executable failures", async () => {
        const dir = await mkdtemp(path.join(os.tmpdir(), "daycare-agent-task-failure-"));
        try {
            const config = configResolve(
                {
                    engine: { dataDir: dir },
                    providers: [{ id: "openai", model: "gpt-4.1" }]
                },
                path.join(dir, "settings.json")
            );
            const complete = vi.fn(async () => ({
                providerId: "openai",
                modelId: "gpt-4.1",
                message: {
                    role: "assistant" as const,
                    content: [{ type: "text" as const, text: "handled task failure" }],
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
            }));
            const agentSystem = new AgentSystem({
                config: new ConfigModule(config),
                eventBus: new EngineEventBus(),
                storage: await storageOpen(config.db.path),
                connectorRegistry: new ConnectorRegistry({
                    onMessage: async () => undefined
                }),
                imageRegistry: new ImageGenerationRegistry(),
                mediaRegistry: new MediaAnalysisRegistry(),
                toolResolver: new ToolResolver(),
                pluginManager: pluginManagerStubBuild(),
                inferenceRouter: { complete } as unknown as InferenceRouter,
                authStore: new AuthStore(config)
            });
            agentSystem.setCrons({ listTasks: async () => [] } as unknown as Crons);
            agentSystem.setWebhooks({} as Parameters<AgentSystem["setWebhooks"]>[0]);
            await agentSystem.load();
            await agentSystem.start();

            const ownerCtx = await agentSystem.ownerCtxEnsure();
            const taskId = createId();
            const now = Date.now();
            await agentSystem.storage.tasks.create({
                id: taskId,
                userId: ownerCtx.userId,
                title: "Broken task",
                description: null,
                code: "def broken(",
                parameters: null,
                createdAt: now,
                updatedAt: now,
                version: 1,
                validFrom: now,
                validTo: null
            });

            const result = await postAndAwait(
                agentSystem,
                { descriptor: { type: "task", id: taskId } },
                {
                    type: "system_message",
                    text: "[cron]\ntask run",
                    task: { id: taskId, version: 1 },
                    origin: "cron"
                }
            );
            if (result.type !== "system_message") {
                throw new Error("Expected system_message result");
            }
            expect(result.responseError).toBe(true);
            expect(complete).toHaveBeenCalledTimes(1);

            const agentId = await agentIdForTarget(agentSystem, { descriptor: { type: "task", id: taskId } });
            const history = await agentHistoryLoadAll(
                agentSystem.storage,
                await contextForAgentIdRequire(agentSystem, agentId)
            );
            const userRecord = history.find((record) => record.type === "user_message");
            if (!userRecord || userRecord.type !== "user_message") {
                throw new Error("Expected user_message history record");
            }
            expect(userRecord.text).toContain("<exec_error>");
        } finally {
            await rm(dir, { recursive: true, force: true });
        }
    });

    it("writes rlm history for executable skip() without adding context history", async () => {
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
                storage: await storageOpen(config.db.path),
                connectorRegistry: new ConnectorRegistry({
                    onMessage: async () => undefined
                }),
                imageRegistry: new ImageGenerationRegistry(),
                mediaRegistry: new MediaAnalysisRegistry(),
                toolResolver: new ToolResolver(),
                pluginManager: pluginManagerStubBuild(),
                inferenceRouter: inferenceRouterStubBuild(),
                authStore: new AuthStore(config)
            });
            agentSystem.setCrons({ listTasks: async () => [] } as unknown as Crons);
            agentSystem.setWebhooks({} as Parameters<AgentSystem["setWebhooks"]>[0]);
            await agentSystem.load();
            await agentSystem.start();

            const descriptor: AgentDescriptor = {
                type: "cron",
                id: createId(),
                name: "Executable prompt cron"
            };
            const result = await postAndAwait(
                agentSystem,
                { descriptor },
                {
                    type: "system_message",
                    text: "run skip",
                    code: "skip()",
                    origin: "cron"
                }
            );
            if (result.type !== "system_message") {
                throw new Error("Expected system_message result");
            }
            expect(result.responseText).toBeNull();
            expect(result.responseError).toBeUndefined();

            const agentId = await agentIdForTarget(agentSystem, { descriptor });
            const ctx = await contextForAgentIdRequire(agentSystem, agentId);
            const history = await agentHistoryLoadAll(agentSystem.storage, ctx);
            const starts = history.filter(
                (record): record is Extract<AgentHistoryRecord, { type: "rlm_start" }> => record.type === "rlm_start"
            );
            const completes = history.filter(
                (record): record is Extract<AgentHistoryRecord, { type: "rlm_complete" }> =>
                    record.type === "rlm_complete"
            );
            expect(starts).toHaveLength(1);
            expect(completes).toHaveLength(1);
            expect(completes[0]?.isError).toBe(false);
            expect(completes[0]?.output).toBe("Turn skipped");
            expect(history.some((record) => record.type === "user_message")).toBe(false);

            const state = await agentStateRead(agentSystem.storage, ctx);
            if (!state) {
                throw new Error("State not found");
            }
            expect(state.context.messages ?? []).toHaveLength(0);
        } finally {
            await rm(dir, { recursive: true, force: true });
        }
    });

    it("rejects executable system messages with multiple code blocks", async () => {
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
                storage: await storageOpen(config.db.path),
                connectorRegistry: new ConnectorRegistry({
                    onMessage: async () => undefined
                }),
                imageRegistry: new ImageGenerationRegistry(),
                mediaRegistry: new MediaAnalysisRegistry(),
                toolResolver: new ToolResolver(),
                pluginManager: pluginManagerStubBuild(),
                inferenceRouter: inferenceRouterStubBuild(),
                authStore: new AuthStore(config)
            });
            agentSystem.setCrons({ listTasks: async () => [] } as unknown as Crons);
            agentSystem.setWebhooks({} as Parameters<AgentSystem["setWebhooks"]>[0]);
            await agentSystem.load();
            await agentSystem.start();

            const descriptor: AgentDescriptor = {
                type: "cron",
                id: createId(),
                name: "Executable prompt cron"
            };
            const result = await postAndAwait(agentSystem, { descriptor }, {
                type: "system_message",
                text: "sync run",
                code: ["raise Exception('boom')", "1 + 1"],
                origin: "cron",
                sync: true
            } as unknown as AgentInboxItem);
            if (result.type !== "system_message") {
                throw new Error("Expected system_message result");
            }
            expect(result.responseError).toBe(true);
            expect(result.executionErrorText).toContain("requires exactly one code block");
            expect(result.responseText).toContain("<exec_error>");
        } finally {
            await rm(dir, { recursive: true, force: true });
        }
    });

    it("uses memory-agent system prompt and skips first-message prepend", async () => {
        const dir = await mkdtemp(path.join(os.tmpdir(), "daycare-agent-memory-prompt-"));
        try {
            const config = configResolve(
                {
                    engine: { dataDir: dir },
                    providers: [{ id: "openai", model: "gpt-4.1" }]
                },
                path.join(dir, "settings.json")
            );
            const complete = vi.fn(async (_context: unknown, _sessionId: string) => ({
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
            }));
            const agentSystem = new AgentSystem({
                config: new ConfigModule(config),
                eventBus: new EngineEventBus(),
                storage: await storageOpen(config.db.path),
                connectorRegistry: new ConnectorRegistry({
                    onMessage: async () => undefined
                }),
                imageRegistry: new ImageGenerationRegistry(),
                mediaRegistry: new MediaAnalysisRegistry(),
                toolResolver: new ToolResolver(),
                pluginManager: pluginManagerStubBuild(),
                inferenceRouter: { complete } as unknown as InferenceRouter,
                authStore: new AuthStore(config)
            });
            agentSystem.setCrons({ listTasks: async () => [] } as unknown as Crons);
            agentSystem.setWebhooks({} as Parameters<AgentSystem["setWebhooks"]>[0]);
            await agentSystem.load();
            await agentSystem.start();

            const sourceDescriptor: AgentDescriptor = {
                type: "cron",
                id: createId(),
                name: "memory-source"
            };
            await postAndAwait(
                agentSystem,
                { descriptor: sourceDescriptor },
                { type: "reset", message: "seed source" }
            );
            const sourceAgentId = await agentIdForTarget(agentSystem, { descriptor: sourceDescriptor });
            const sourceCtx = await contextForAgentIdRequire(agentSystem, sourceAgentId);

            const firstMessageSentinel = "FIRST_MESSAGE_PROMPT_SHOULD_NOT_APPEAR";
            const now = Date.now();
            await agentSystem.storage.systemPrompts.create({
                id: createId(),
                scope: "user",
                userId: sourceCtx.userId,
                kind: "first_message",
                condition: null,
                prompt: firstMessageSentinel,
                enabled: true,
                createdAt: now,
                updatedAt: now
            });

            const sourcePath = agentSystem.getAgentPath(sourceAgentId);
            if (!sourcePath) {
                throw new Error("Missing source path for memory agent");
            }
            await postAndAwait(
                agentSystem,
                { path: agentPathMemory(sourcePath) },
                {
                    type: "system_message",
                    text: "PostgreSQL in production was upgraded to version 16.",
                    origin: "memory-worker:test"
                }
            );

            expect(complete).toHaveBeenCalledOnce();
            const firstCall = complete.mock.calls[0];
            if (!firstCall) {
                throw new Error("Expected inference call");
            }
            const inferenceContext = firstCall[0] as {
                systemPrompt?: string;
                messages?: Array<{ role?: string; content?: unknown }>;
            };
            expect(inferenceContext.systemPrompt ?? "").toContain("You are a memory processing agent.");

            const userMessage = (inferenceContext.messages ?? []).find((message) => message.role === "user");
            const userText =
                typeof userMessage?.content === "string"
                    ? userMessage.content
                    : JSON.stringify(userMessage?.content ?? "");
            expect(userText).toContain("<system_message");
            expect(userText).not.toContain(firstMessageSentinel);
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
                storage: await storageOpen(config.db.path),
                connectorRegistry,
                imageRegistry: new ImageGenerationRegistry(),
                mediaRegistry: new MediaAnalysisRegistry(),
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
            const beforeCompaction = await agentStateRead(
                agentSystem.storage,
                await contextForAgentIdRequire(agentSystem, agentId)
            );
            expect(beforeCompaction?.inferenceSessionId).toBeTruthy();
            const result = await postAndAwait(
                agentSystem,
                { descriptor },
                { type: "compact", context: { messageId: "88" } }
            );

            expect(result).toEqual({ type: "compact", ok: true });
            expect(complete).toHaveBeenCalledTimes(1);
            expect(receivedSessionId).toBe(beforeCompaction?.inferenceSessionId);
            expect(startTyping).toHaveBeenCalledWith("user-1");
            expect(stopTyping).toHaveBeenCalledTimes(1);
            expect(sendMessage).toHaveBeenLastCalledWith("user-1", {
                text: "Session compacted.",
                replyToMessageId: "88"
            });

            const state = await agentStateRead(
                agentSystem.storage,
                await contextForAgentIdRequire(agentSystem, agentId)
            );
            expect(state?.activeSessionId).toBeTruthy();
            expect(state?.activeSessionId).not.toBe(beforeCompaction?.activeSessionId);
            const history = await agentHistoryLoad(
                agentSystem.storage,
                await contextForAgentIdRequire(agentSystem, agentId)
            );
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
                storage: await storageOpen(config.db.path),
                connectorRegistry,
                imageRegistry: new ImageGenerationRegistry(),
                mediaRegistry: new MediaAnalysisRegistry(),
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
            expect(sendMessage).toHaveBeenLastCalledWith("user-1", {
                text: "Compaction produced an empty summary; context unchanged.",
                replyToMessageId: "89"
            });

            await connectorRegistry.unregisterAll("test");
        } finally {
            await rm(dir, { recursive: true, force: true });
        }
    });

    it("runs pre-turn compaction from provider usage tokens before inference", async () => {
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

            let nonCompactionCallCount = 0;
            const complete = vi.fn(async (context: { messages?: Array<{ role?: string; content?: unknown }> }) => {
                const isCompactionRequest = (context.messages ?? []).some((message) => {
                    if (message.role !== "user") {
                        return false;
                    }
                    const contentText =
                        typeof message.content === "string" ? message.content : JSON.stringify(message.content ?? "");
                    return contentText.includes("Summarize the conversation above into a compact context checkpoint.");
                });
                if (isCompactionRequest) {
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
                }
                if (nonCompactionCallCount === 0) {
                    nonCompactionCallCount += 1;
                    return {
                        providerId: "openai",
                        modelId: "gpt-4.1",
                        message: {
                            role: "assistant",
                            content: [{ type: "text", text: "seed response" }],
                            api: "openai-responses",
                            provider: "openai",
                            model: "gpt-4.1",
                            usage: {
                                input: 175_000,
                                output: 5_000,
                                cacheRead: 18_000,
                                cacheWrite: 1_000,
                                totalTokens: 199_000,
                                cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 }
                            },
                            stopReason: "stop",
                            timestamp: Date.now()
                        }
                    };
                }
                nonCompactionCallCount += 1;
                return {
                    providerId: "openai",
                    modelId: "gpt-4.1",
                    message: {
                        role: "assistant",
                        content: [{ type: "text", text: "after compaction" }],
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
                storage: await storageOpen(config.db.path),
                connectorRegistry,
                imageRegistry: new ImageGenerationRegistry(),
                mediaRegistry: new MediaAnalysisRegistry(),
                toolResolver: new ToolResolver(),
                pluginManager: pluginManagerStubBuild(),
                inferenceRouter,
                authStore: new AuthStore(config)
            });
            agentSystem.setCrons({} as unknown as Crons);
            agentSystem.setWebhooks({} as Parameters<AgentSystem["setWebhooks"]>[0]);
            await agentSystem.load();
            await agentSystem.start();

            const descriptor: AgentDescriptor = {
                type: "user",
                connector: "telegram",
                channelId: "channel-1",
                userId: "user-1"
            };

            await postAndAwait(agentSystem, { descriptor }, { type: "reset", message: "seed context" });
            await postAndAwait(
                agentSystem,
                { descriptor },
                {
                    type: "message",
                    message: { text: "seed usage" },
                    context: { messageId: "89" }
                }
            );

            const result = await postAndAwait(
                agentSystem,
                { descriptor },
                {
                    type: "message",
                    message: { text: "please continue" },
                    context: { messageId: "90" }
                }
            );

            expect(result).toEqual({ type: "message", responseText: "after compaction" });
            expect(complete).toHaveBeenCalledTimes(3);
            expect(sendMessage).toHaveBeenCalledWith("user-1", {
                text: "⏳ Compacting session context. I'll continue shortly.",
                replyToMessageId: "90"
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
                storage: await storageOpen(config.db.path),
                connectorRegistry: new ConnectorRegistry({
                    onMessage: async () => undefined
                }),
                imageRegistry: new ImageGenerationRegistry(),
                mediaRegistry: new MediaAnalysisRegistry(),
                toolResolver: new ToolResolver(),
                pluginManager: {} as unknown as PluginManager,
                inferenceRouter: {} as unknown as InferenceRouter,
                authStore: new AuthStore(config)
            });
            agentSystem.setCrons({} as unknown as Crons);
            const signals = await signalsBuild(config, eventBus, async (signal, subscriptions) => {
                await agentSystem.signalDeliver(signal, subscriptions);
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

            const history = await agentHistoryLoad(
                agentSystem.storage,
                await contextForAgentIdRequire(agentSystem, agentId)
            );
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
                storage: await storageOpen(config.db.path),
                connectorRegistry: new ConnectorRegistry({
                    onMessage: async () => undefined
                }),
                imageRegistry: new ImageGenerationRegistry(),
                mediaRegistry: new MediaAnalysisRegistry(),
                toolResolver: new ToolResolver(),
                pluginManager: {} as unknown as PluginManager,
                inferenceRouter: {} as unknown as InferenceRouter,
                authStore: new AuthStore(config)
            });
            agentSystem.setCrons({} as unknown as Crons);
            const signals = await signalsBuild(config, eventBus, async (signal, subscriptions) => {
                await agentSystem.signalDeliver(signal, subscriptions);
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

            const history = await agentHistoryLoadAll(
                agentSystem.storage,
                await contextForAgentIdRequire(agentSystem, agentId)
            );
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
                storage: await storageOpen(config.db.path),
                connectorRegistry: new ConnectorRegistry({
                    onMessage: async () => undefined
                }),
                imageRegistry: new ImageGenerationRegistry(),
                mediaRegistry: new MediaAnalysisRegistry(),
                toolResolver: new ToolResolver(),
                pluginManager: {} as unknown as PluginManager,
                inferenceRouter: {} as unknown as InferenceRouter,
                authStore: new AuthStore(config)
            });
            agentSystem.setCrons({} as unknown as Crons);
            const signals = await signalsBuild(config, eventBus, async (signal, subscriptions) => {
                await agentSystem.signalDeliver(signal, subscriptions);
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

            const sourceHistory = await agentHistoryLoadAll(
                config,
                await contextForAgentIdRequire(agentSystem, sourceAgentId)
            );
            expect(historyHasSignalText(sourceHistory)).toBe(false);

            const peerHistory = await agentHistoryLoadAll(
                config,
                await contextForAgentIdRequire(agentSystem, peerAgentId)
            );
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
                storage: await storageOpen(config.db.path),
                connectorRegistry: new ConnectorRegistry({
                    onMessage: async () => undefined
                }),
                imageRegistry: new ImageGenerationRegistry(),
                mediaRegistry: new MediaAnalysisRegistry(),
                toolResolver: new ToolResolver(),
                pluginManager: {} as unknown as PluginManager,
                inferenceRouter: {} as unknown as InferenceRouter,
                authStore: new AuthStore(config)
            });
            agentSystem.setCrons({} as unknown as Crons);
            const signals = await signalsBuild(config, eventBus);
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
            const signals = await signalsBuild(config, eventBus);
            delayedSignals = await delayedSignalsBuild(configModule, eventBus, signals);
            const agentSystem = new AgentSystem({
                config: configModule,
                eventBus,
                storage: await storageOpen(config.db.path),
                connectorRegistry: new ConnectorRegistry({
                    onMessage: async () => undefined
                }),
                imageRegistry: new ImageGenerationRegistry(),
                mediaRegistry: new MediaAnalysisRegistry(),
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
            const signals = await signalsBuild(config, eventBus);
            delayedSignals = await delayedSignalsBuild(configModule, eventBus, signals);
            const agentSystem = new AgentSystem({
                config: configModule,
                eventBus,
                storage: await storageOpen(config.db.path),
                connectorRegistry: new ConnectorRegistry({
                    onMessage: async () => undefined
                }),
                imageRegistry: new ImageGenerationRegistry(),
                mediaRegistry: new MediaAnalysisRegistry(),
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
            const agentSystem = {
                extraMountsForUserId: () => []
            } as unknown as AgentSystem;

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
                contextForAgent({ userId, agentId }),
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

    it("resumes pending rlm tool_call on restore and continues inference from toolResult", async () => {
        const dir = await mkdtemp(path.join(os.tmpdir(), "daycare-agent-"));
        let agentSystem: AgentSystem | null = null;
        try {
            const config = configResolve(
                {
                    engine: { dataDir: dir },
                    providers: [{ id: "openai", model: "gpt-4.1" }]
                },
                path.join(dir, "settings.json")
            );
            const complete = vi.fn(async (..._args: unknown[]) => ({
                providerId: "openai",
                modelId: "gpt-4.1",
                message: {
                    role: "assistant",
                    content: [{ type: "text", text: "continued after restart" }],
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
            }));
            agentSystem = new AgentSystem({
                config: new ConfigModule(config),
                eventBus: new EngineEventBus(),
                storage: await storageOpenTest(),
                connectorRegistry: new ConnectorRegistry({
                    onMessage: async () => undefined
                }),
                imageRegistry: new ImageGenerationRegistry(),
                mediaRegistry: new MediaAnalysisRegistry(),
                toolResolver: new ToolResolver(),
                pluginManager: pluginManagerStubBuild(),
                inferenceRouter: { complete } as unknown as InferenceRouter,
                authStore: new AuthStore(config)
            });
            agentSystem.setCrons({} as unknown as Crons);
            agentSystem.setWebhooks({} as Parameters<AgentSystem["setWebhooks"]>[0]);
            await agentSystem.load();
            await agentSystem.start();

            const descriptor: AgentDescriptor = {
                type: "user",
                connector: "slack",
                channelId: "channel-1",
                userId: "user-1"
            };
            await postAndAwait(
                agentSystem,
                { descriptor },
                {
                    type: "reset",
                    message: "seed session"
                }
            );
            const agentId = await agentIdForTarget(agentSystem, { descriptor });
            const ctx = await contextForAgentIdRequire(agentSystem, agentId);

            const startedAt = Date.now();
            const snapshotDump = await pendingToolCallSnapshotBuild();
            const preamble = montyPreambleBuild([waitToolBuild()]);
            await agentSystem.storage.appendHistory(agentId, {
                type: "assistant_message",
                at: startedAt - 1,
                tokens: null,
                content: [{ type: "toolCall", id: "tool-call-1", name: "run_python", arguments: { code: "wait(300)" } }]
            });
            await agentSystem.storage.appendHistory(agentId, {
                type: "rlm_start",
                at: startedAt,
                toolCallId: "tool-call-1",
                code: "wait(300)",
                preamble
            });
            const sessionId = (await agentSystem.storage.agents.findById(agentId))?.activeSessionId ?? null;
            if (!sessionId) {
                throw new Error("Expected active session before snapshot persist.");
            }
            const snapshotId = await rlmSnapshotSave({
                config,
                agentId,
                sessionId,
                snapshotDump
            });
            await agentSystem.storage.appendHistory(agentId, {
                type: "rlm_tool_call",
                at: startedAt + 1,
                toolCallId: "tool-call-1",
                snapshotId,
                printOutput: ["waiting..."],
                toolCallCount: 2,
                toolName: "wait",
                toolArgs: { seconds: 300 }
            });

            const restoreResult = await postAndAwait(agentSystem, { agentId }, { type: "restore" });
            expect(restoreResult).toEqual({ type: "restore", ok: true });

            const history = await agentHistoryLoad(agentSystem.storage, ctx);
            const completed = [...history]
                .reverse()
                .find(
                    (record): record is Extract<AgentHistoryRecord, { type: "rlm_complete" }> =>
                        record.type === "rlm_complete" && record.toolCallId === "tool-call-1"
                );
            expect(completed).toBeTruthy();
            expect(completed?.isError).toBe(true);
            expect(completed?.error).toContain("Daycare server was restarted during executing this command");
            expect(completed?.toolCallCount).toBe(2);
            expect(completed?.printOutput).toEqual(["waiting..."]);
            expect(complete).toHaveBeenCalledTimes(1);
            const recoveryOptions = complete.mock.calls[0]?.[2] as
                | { providersOverride?: Array<{ id: string; model: string }> }
                | undefined;
            expect(recoveryOptions?.providersOverride).toHaveLength(1);
            expect(recoveryOptions?.providersOverride?.[0]).toMatchObject({ id: "openai", model: "gpt-4.1" });
            const recoveryContext = complete.mock.calls[0]?.[0] as { messages?: unknown[] } | undefined;
            const hasRunPythonToolCall = recoveryContext?.messages?.some((message) => {
                if (typeof message !== "object" || message === null) {
                    return false;
                }
                const role = (message as { role?: unknown }).role;
                const content = (message as { content?: unknown }).content;
                if (role !== "assistant" || !Array.isArray(content)) {
                    return false;
                }
                return content.some(
                    (part) =>
                        typeof part === "object" &&
                        part !== null &&
                        "type" in part &&
                        "id" in part &&
                        "name" in part &&
                        (part as { type?: string; id?: string; name?: string }).type === "toolCall" &&
                        (part as { id?: string }).id === "tool-call-1" &&
                        (part as { name?: string }).name === "run_python"
                );
            });
            const hasToolResult = recoveryContext?.messages?.some((message) => {
                if (typeof message !== "object" || message === null) {
                    return false;
                }
                const role = (message as { role?: unknown }).role;
                const content = (message as { content?: unknown }).content;
                const toolCallId = (message as { toolCallId?: unknown }).toolCallId;
                if (role !== "toolResult" || toolCallId !== "tool-call-1" || !Array.isArray(content)) {
                    return false;
                }
                return content.some(
                    (part) =>
                        typeof part === "object" &&
                        part !== null &&
                        "type" in part &&
                        "text" in part &&
                        (part as { type?: string; text?: string }).type === "text" &&
                        (part as { text?: string }).text?.includes(
                            "Daycare server was restarted during executing this command"
                        )
                );
            });
            expect(hasRunPythonToolCall).toBe(true);
            expect(hasToolResult).toBe(true);
        } finally {
            await rm(dir, { recursive: true, force: true });
        }
    });

    it("sends restore recovery response through user connector", async () => {
        const dir = await mkdtemp(path.join(os.tmpdir(), "daycare-agent-"));
        let agentSystem: AgentSystem | null = null;
        try {
            const config = configResolve(
                {
                    engine: { dataDir: dir },
                    providers: [{ id: "openai", model: "gpt-4.1" }]
                },
                path.join(dir, "settings.json")
            );
            const sendMessage = vi.fn(async () => undefined);
            const connectorRegistry = new ConnectorRegistry({
                onMessage: async () => undefined
            });
            const connector: Connector = {
                capabilities: { sendText: true },
                onMessage: () => () => undefined,
                sendMessage
            };
            expect(connectorRegistry.register("telegram", connector)).toEqual({ ok: true, status: "loaded" });
            const complete = vi.fn(async (..._args: unknown[]) => ({
                providerId: "openai",
                modelId: "gpt-4.1",
                message: {
                    role: "assistant",
                    content: [{ type: "text", text: "continued after restart" }],
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
            }));
            agentSystem = new AgentSystem({
                config: new ConfigModule(config),
                eventBus: new EngineEventBus(),
                storage: await storageOpenTest(),
                connectorRegistry,
                imageRegistry: new ImageGenerationRegistry(),
                mediaRegistry: new MediaAnalysisRegistry(),
                toolResolver: new ToolResolver(),
                pluginManager: pluginManagerStubBuild(),
                inferenceRouter: { complete } as unknown as InferenceRouter,
                authStore: new AuthStore(config)
            });
            agentSystem.setCrons({} as unknown as Crons);
            agentSystem.setWebhooks({} as Parameters<AgentSystem["setWebhooks"]>[0]);
            await agentSystem.load();
            await agentSystem.start();

            const descriptor: AgentDescriptor = {
                type: "user",
                connector: "telegram",
                channelId: "channel-1",
                userId: "user-1"
            };
            await postAndAwait(
                agentSystem,
                { descriptor },
                {
                    type: "reset",
                    message: "seed session"
                }
            );
            const agentId = await agentIdForTarget(agentSystem, { descriptor });

            const startedAt = Date.now();
            const snapshotDump = await pendingToolCallSnapshotBuild();
            const preamble = montyPreambleBuild([waitToolBuild()]);
            await agentSystem.storage.appendHistory(agentId, {
                type: "assistant_message",
                at: startedAt - 1,
                tokens: null,
                content: [{ type: "toolCall", id: "tool-call-1", name: "run_python", arguments: { code: "wait(300)" } }]
            });
            await agentSystem.storage.appendHistory(agentId, {
                type: "rlm_start",
                at: startedAt,
                toolCallId: "tool-call-1",
                code: "wait(300)",
                preamble
            });
            const sessionId = (await agentSystem.storage.agents.findById(agentId))?.activeSessionId ?? null;
            if (!sessionId) {
                throw new Error("Expected active session before snapshot persist.");
            }
            const snapshotId = await rlmSnapshotSave({
                config,
                agentId,
                sessionId,
                snapshotDump
            });
            await agentSystem.storage.appendHistory(agentId, {
                type: "rlm_tool_call",
                at: startedAt + 1,
                toolCallId: "tool-call-1",
                snapshotId,
                printOutput: ["waiting..."],
                toolCallCount: 2,
                toolName: "wait",
                toolArgs: { seconds: 300 }
            });

            const restoreResult = await postAndAwait(agentSystem, { agentId }, { type: "restore" });
            expect(restoreResult).toEqual({ type: "restore", ok: true });
            expect(sendMessage).toHaveBeenCalledWith(
                "user-1",
                expect.objectContaining({
                    text: "continued after restart"
                })
            );
            await connectorRegistry.unregisterAll("test");
        } finally {
            if (agentSystem) {
                await agentSystem.storage.connection.close().catch(() => undefined);
            }
            await rm(dir, { recursive: true, force: true });
        }
    });

    it("continues inference after synthetic rlm_complete when pending start has no snapshot", async () => {
        const dir = await mkdtemp(path.join(os.tmpdir(), "daycare-agent-"));
        try {
            const config = configResolve(
                {
                    engine: { dataDir: dir },
                    providers: [{ id: "openai", model: "gpt-4.1" }]
                },
                path.join(dir, "settings.json")
            );
            const complete = vi.fn(async (..._args: unknown[]) => ({
                providerId: "openai",
                modelId: "gpt-4.1",
                message: {
                    role: "assistant",
                    content: [{ type: "text", text: "continued after synthetic failure" }],
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
            }));
            const agentSystem = new AgentSystem({
                config: new ConfigModule(config),
                eventBus: new EngineEventBus(),
                storage: await storageOpenTest(),
                connectorRegistry: new ConnectorRegistry({
                    onMessage: async () => undefined
                }),
                imageRegistry: new ImageGenerationRegistry(),
                mediaRegistry: new MediaAnalysisRegistry(),
                toolResolver: new ToolResolver(),
                pluginManager: pluginManagerStubBuild(),
                inferenceRouter: { complete } as unknown as InferenceRouter,
                authStore: new AuthStore(config)
            });
            agentSystem.setCrons({} as unknown as Crons);
            agentSystem.setWebhooks({} as Parameters<AgentSystem["setWebhooks"]>[0]);
            await agentSystem.load();
            await agentSystem.start();

            const descriptor: AgentDescriptor = {
                type: "user",
                connector: "slack",
                channelId: "channel-1",
                userId: "user-1"
            };
            await postAndAwait(
                agentSystem,
                { descriptor },
                {
                    type: "reset",
                    message: "seed session"
                }
            );
            const agentId = await agentIdForTarget(agentSystem, { descriptor });
            const ctx = await contextForAgentIdRequire(agentSystem, agentId);

            const startedAt = Date.now();
            const preamble = montyPreambleBuild([waitToolBuild()]);
            await agentSystem.storage.appendHistory(agentId, {
                type: "assistant_message",
                at: startedAt - 1,
                tokens: null,
                content: [{ type: "toolCall", id: "tool-call-1", name: "run_python", arguments: { code: "wait(300)" } }]
            });
            await agentSystem.storage.appendHistory(agentId, {
                type: "rlm_start",
                at: startedAt,
                toolCallId: "tool-call-1",
                code: "wait(300)",
                preamble
            });

            const restoreResult = await postAndAwait(agentSystem, { agentId }, { type: "restore" });
            expect(restoreResult).toEqual({ type: "restore", ok: true });

            const history = await agentHistoryLoad(agentSystem.storage, ctx);
            const completed = [...history]
                .reverse()
                .find(
                    (record): record is Extract<AgentHistoryRecord, { type: "rlm_complete" }> =>
                        record.type === "rlm_complete" && record.toolCallId === "tool-call-1"
                );
            expect(completed).toBeTruthy();
            expect(completed?.isError).toBe(true);
            expect(completed?.error).toContain("before any tool call");
            expect(complete).toHaveBeenCalledTimes(1);
            const recoveryOptions = complete.mock.calls[0]?.[2] as
                | { providersOverride?: Array<{ id: string; model: string }> }
                | undefined;
            expect(recoveryOptions?.providersOverride).toHaveLength(1);
            expect(recoveryOptions?.providersOverride?.[0]).toMatchObject({ id: "openai", model: "gpt-4.1" });

            const recoveryContext = complete.mock.calls[0]?.[0] as { messages?: unknown[] } | undefined;
            const hasRunPythonToolCall = recoveryContext?.messages?.some((message) => {
                if (typeof message !== "object" || message === null) {
                    return false;
                }
                const role = (message as { role?: unknown }).role;
                const content = (message as { content?: unknown }).content;
                if (role !== "assistant" || !Array.isArray(content)) {
                    return false;
                }
                return content.some(
                    (part) =>
                        typeof part === "object" &&
                        part !== null &&
                        "type" in part &&
                        "id" in part &&
                        "name" in part &&
                        (part as { type?: string; id?: string; name?: string }).type === "toolCall" &&
                        (part as { id?: string }).id === "tool-call-1" &&
                        (part as { name?: string }).name === "run_python"
                );
            });
            const hasToolResult = recoveryContext?.messages?.some((message) => {
                if (typeof message !== "object" || message === null) {
                    return false;
                }
                const role = (message as { role?: unknown }).role;
                const content = (message as { content?: unknown }).content;
                const toolCallId = (message as { toolCallId?: unknown }).toolCallId;
                if (role !== "toolResult" || toolCallId !== "tool-call-1" || !Array.isArray(content)) {
                    return false;
                }
                return content.some(
                    (part) =>
                        typeof part === "object" &&
                        part !== null &&
                        "type" in part &&
                        "text" in part &&
                        (part as { type?: string; text?: string }).type === "text" &&
                        (part as { text?: string }).text?.includes("before any tool call")
                );
            });
            expect(hasRunPythonToolCall).toBe(true);
            expect(hasToolResult).toBe(true);
        } finally {
            await rm(dir, { recursive: true, force: true });
        }
    });

    it("simulates python vm crash when pending snapshot cannot be loaded on restore", async () => {
        const dir = await mkdtemp(path.join(os.tmpdir(), "daycare-agent-"));
        try {
            const config = configResolve({ engine: { dataDir: dir } }, path.join(dir, "settings.json"));
            const complete = vi.fn(async (..._args: unknown[]) => ({
                providerId: "openai",
                modelId: "gpt-4.1",
                message: {
                    role: "assistant",
                    content: [{ type: "text", text: "continued after snapshot crash" }],
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
            }));
            const agentSystem = new AgentSystem({
                config: new ConfigModule(config),
                eventBus: new EngineEventBus(),
                storage: await storageOpenTest(),
                connectorRegistry: new ConnectorRegistry({
                    onMessage: async () => undefined
                }),
                imageRegistry: new ImageGenerationRegistry(),
                mediaRegistry: new MediaAnalysisRegistry(),
                toolResolver: new ToolResolver(),
                pluginManager: pluginManagerStubBuild(),
                inferenceRouter: { complete } as unknown as InferenceRouter,
                authStore: new AuthStore(config)
            });
            agentSystem.setCrons({} as unknown as Crons);
            agentSystem.setWebhooks({} as Parameters<AgentSystem["setWebhooks"]>[0]);
            await agentSystem.load();
            await agentSystem.start();

            const descriptor: AgentDescriptor = {
                type: "user",
                connector: "slack",
                channelId: "channel-1",
                userId: "user-1"
            };
            await postAndAwait(
                agentSystem,
                { descriptor },
                {
                    type: "reset",
                    message: "seed session"
                }
            );
            const agentId = await agentIdForTarget(agentSystem, { descriptor });
            const ctx = await contextForAgentIdRequire(agentSystem, agentId);

            const startedAt = Date.now();
            const preamble = montyPreambleBuild([waitToolBuild()]);
            await agentSystem.storage.appendHistory(agentId, {
                type: "assistant_message",
                at: startedAt - 1,
                content: [{ type: "text", text: "<run_python>wait(300)</run_python>" }],
                tokens: null
            });
            await agentSystem.storage.appendHistory(agentId, {
                type: "rlm_start",
                at: startedAt,
                toolCallId: "tool-call-crash",
                code: "wait(300)",
                preamble
            });

            const persistedAgent = await agentSystem.storage.agents.findById(agentId);
            const sessionId = persistedAgent?.activeSessionId ?? "";
            await agentSystem.storage.history.append(sessionId, {
                type: "rlm_tool_call",
                at: startedAt + 1,
                toolCallId: "tool-call-crash",
                snapshotId: createId(),
                printOutput: ["waiting..."],
                toolCallCount: 1,
                toolName: "wait",
                toolArgs: { seconds: 300 }
            });

            const restoreResult = await postAndAwait(agentSystem, { agentId }, { type: "restore" });
            expect(restoreResult).toEqual({ type: "restore", ok: true });

            const history = await agentHistoryLoad(agentSystem.storage, ctx);
            const completed = [...history]
                .reverse()
                .find(
                    (record): record is Extract<AgentHistoryRecord, { type: "rlm_complete" }> =>
                        record.type === "rlm_complete" && record.toolCallId === "tool-call-crash"
                );
            expect(completed).toBeTruthy();
            expect(completed?.isError).toBe(true);
            expect(completed?.error).toContain("Python VM crashed");
            expect(completed?.printOutput).toEqual(["waiting..."]);
            expect(complete).toHaveBeenCalledTimes(1);
        } finally {
            await rm(dir, { recursive: true, force: true });
        }
    });

    it("keeps history on restore when pending recovery and connector error reporting both fail", async () => {
        const dir = await mkdtemp(path.join(os.tmpdir(), "daycare-agent-"));
        try {
            const config = configResolve(
                {
                    engine: { dataDir: dir },
                    providers: [{ id: "openai", model: "gpt-4.1" }]
                },
                path.join(dir, "settings.json")
            );
            const sendMessage = vi.fn(async () => {
                throw new Error("connector unavailable");
            });
            const connectorRegistry = new ConnectorRegistry({
                onMessage: async () => undefined
            });
            const connector: Connector = {
                capabilities: { sendText: true },
                onMessage: () => () => undefined,
                sendMessage
            };
            expect(connectorRegistry.register("telegram", connector)).toEqual({ ok: true, status: "loaded" });

            const complete = vi.fn();
            complete.mockRejectedValueOnce(new Error("provider unavailable during restore"));
            complete.mockResolvedValueOnce({
                providerId: "openai",
                modelId: "gpt-4.1",
                message: {
                    role: "assistant",
                    content: [{ type: "text", text: "history kept" }],
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
            });

            const agentSystem = new AgentSystem({
                config: new ConfigModule(config),
                eventBus: new EngineEventBus(),
                storage: await storageOpenTest(),
                connectorRegistry,
                imageRegistry: new ImageGenerationRegistry(),
                mediaRegistry: new MediaAnalysisRegistry(),
                toolResolver: new ToolResolver(),
                pluginManager: pluginManagerStubBuild(),
                inferenceRouter: { complete } as unknown as InferenceRouter,
                authStore: new AuthStore(config)
            });
            agentSystem.setCrons({} as unknown as Crons);
            agentSystem.setWebhooks({} as Parameters<AgentSystem["setWebhooks"]>[0]);
            await agentSystem.load();
            await agentSystem.start();

            const descriptor: AgentDescriptor = {
                type: "user",
                connector: "telegram",
                channelId: "channel-1",
                userId: "user-1"
            };
            await postAndAwait(
                agentSystem,
                { descriptor },
                {
                    type: "reset",
                    message: "seed session"
                }
            );
            const agentId = await agentIdForTarget(agentSystem, { descriptor });

            const startedAt = Date.now();
            const preamble = montyPreambleBuild([waitToolBuild()]);
            await agentSystem.storage.appendHistory(agentId, {
                type: "assistant_message",
                at: startedAt - 1,
                tokens: null,
                content: [
                    {
                        type: "toolCall",
                        id: "tool-call-recover",
                        name: "run_python",
                        arguments: { code: "wait(300)" }
                    }
                ]
            });
            await agentSystem.storage.appendHistory(agentId, {
                type: "rlm_start",
                at: startedAt,
                toolCallId: "tool-call-recover",
                code: "wait(300)",
                preamble
            });
            await agentSystem.storage.appendHistory(agentId, {
                type: "rlm_tool_call",
                at: startedAt + 1,
                toolCallId: "tool-call-recover",
                snapshotId: createId(),
                printOutput: ["waiting..."],
                toolCallCount: 1,
                toolName: "wait",
                toolArgs: { seconds: 300 }
            });

            const restoreResult = await postAndAwait(agentSystem, { agentId }, { type: "restore" });
            expect(restoreResult).toEqual({ type: "restore", ok: true });

            const messageResult = await postAndAwait(
                agentSystem,
                { agentId },
                {
                    type: "message",
                    message: { text: "follow up" },
                    context: {}
                }
            );
            expect(messageResult).toEqual({ type: "message", responseText: "history kept" });

            expect(complete).toHaveBeenCalledTimes(2);
            const secondContext = complete.mock.calls[1]?.[0] as { messages?: unknown[] } | undefined;
            const hasRestoredToolResult = secondContext?.messages?.some((message) => {
                if (typeof message !== "object" || message === null) {
                    return false;
                }
                const role = (message as { role?: unknown }).role;
                const toolCallId = (message as { toolCallId?: unknown }).toolCallId;
                if (role !== "toolResult" || toolCallId !== "tool-call-recover") {
                    return false;
                }
                const content = (message as { content?: unknown }).content;
                if (!Array.isArray(content)) {
                    return false;
                }
                return content.some(
                    (part) =>
                        typeof part === "object" &&
                        part !== null &&
                        "type" in part &&
                        "text" in part &&
                        (part as { type?: string; text?: string }).type === "text" &&
                        (part as { text?: string }).text?.includes("Python VM crashed")
                );
            });
            expect(hasRestoredToolResult).toBe(true);
        } finally {
            await rm(dir, { recursive: true, force: true });
        }
    });

    it("notifies and starts from scratch when history restore has invalid timestamp data", async () => {
        const dir = await mkdtemp(path.join(os.tmpdir(), "daycare-agent-"));
        try {
            const config = configResolve(
                {
                    engine: { dataDir: dir },
                    providers: [{ id: "openai", model: "gpt-4.1" }]
                },
                path.join(dir, "settings.json")
            );
            const sendMessage = vi.fn(async () => undefined);
            const connectorRegistry = new ConnectorRegistry({
                onMessage: async () => undefined
            });
            const connector: Connector = {
                capabilities: { sendText: true },
                onMessage: () => () => undefined,
                sendMessage
            };
            expect(connectorRegistry.register("telegram", connector)).toEqual({ ok: true, status: "loaded" });

            const complete = vi.fn(async (..._args: unknown[]) => ({
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
            }));
            const agentSystem = new AgentSystem({
                config: new ConfigModule(config),
                eventBus: new EngineEventBus(),
                storage: await storageOpenTest(),
                connectorRegistry,
                imageRegistry: new ImageGenerationRegistry(),
                mediaRegistry: new MediaAnalysisRegistry(),
                toolResolver: new ToolResolver(),
                pluginManager: pluginManagerStubBuild(),
                inferenceRouter: { complete } as unknown as InferenceRouter,
                authStore: new AuthStore(config)
            });
            agentSystem.setCrons({} as unknown as Crons);
            agentSystem.setWebhooks({} as Parameters<AgentSystem["setWebhooks"]>[0]);
            await agentSystem.load();
            await agentSystem.start();

            const descriptor: AgentDescriptor = {
                type: "user",
                connector: "telegram",
                channelId: "channel-1",
                userId: "user-1"
            };
            await postAndAwait(
                agentSystem,
                { descriptor },
                {
                    type: "reset",
                    message: "seed session"
                }
            );
            const agentId = await agentIdForTarget(agentSystem, { descriptor });
            const before = await agentSystem.storage.agents.findById(agentId);
            const beforeSessionId = before?.activeSessionId ?? null;
            if (!beforeSessionId) {
                throw new Error("Expected active session before malformed restore fixture.");
            }

            await agentSystem.storage.db.insert(sessionHistoryTable).values({
                sessionId: beforeSessionId,
                type: "user_message",
                at: Date.now(),
                data: JSON.stringify({
                    text: "bad timestamp payload",
                    files: [],
                    at: "not-a-number"
                })
            });

            const restoreResult = await postAndAwait(agentSystem, { agentId }, { type: "restore" });
            expect(restoreResult).toEqual({ type: "restore", ok: true });

            const after = await agentSystem.storage.agents.findById(agentId);
            const afterSessionId = after?.activeSessionId ?? null;
            expect(afterSessionId).toBeTruthy();
            expect(afterSessionId).not.toBe(beforeSessionId);

            const restoredSession = await agentSystem.storage.sessions.findById(afterSessionId ?? "");
            expect(restoredSession?.resetMessage).toBe("Session restore failed - starting from scratch.");

            expect(sendMessage).toHaveBeenCalledWith(
                "user-1",
                expect.objectContaining({
                    text: "Session restore failed - starting from scratch."
                })
            );
        } finally {
            await rm(dir, { recursive: true, force: true });
        }
    });

    it("uses permanent agent workspaceDir as workingDir on restore", async () => {
        const dir = await mkdtemp(path.join(os.tmpdir(), "daycare-agent-"));
        try {
            const config = configResolve({ engine: { dataDir: dir } }, path.join(dir, "settings.json"));
            const agentSystem = {
                extraMountsForUserId: () => []
            } as unknown as AgentSystem;

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
                contextForAgent({ userId, agentId }),
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
    ctxOrTarget: Context | AgentTargetInput,
    targetOrItem: AgentTargetInput | AgentInboxItem,
    maybeItem?: AgentInboxItem
): Promise<AgentInboxResult> {
    if (maybeItem) {
        return agentSystem.postAndAwait(
            ctxOrTarget as Context,
            targetNormalize(targetOrItem as AgentTargetInput, ctxOrTarget as Context),
            maybeItem
        );
    }
    const target = ctxOrTarget as AgentTargetInput;
    const ctx = await callerCtxResolve(agentSystem, target);
    return agentSystem.postAndAwait(ctx, targetNormalize(target, ctx), targetOrItem as AgentInboxItem);
}

async function post(
    agentSystem: AgentSystem,
    ctxOrTarget: Context | AgentTargetInput,
    targetOrItem: AgentTargetInput | AgentInboxItem,
    maybeItem?: AgentInboxItem
): Promise<void> {
    if (maybeItem) {
        await agentSystem.post(
            ctxOrTarget as Context,
            targetNormalize(targetOrItem as AgentTargetInput, ctxOrTarget as Context),
            maybeItem
        );
        return;
    }
    const target = ctxOrTarget as AgentTargetInput;
    const ctx = await callerCtxResolve(agentSystem, target);
    await agentSystem.post(ctx, targetNormalize(target, ctx), targetOrItem as AgentInboxItem);
}

async function agentIdForTarget(
    agentSystem: AgentSystem,
    ctxOrTarget: Context | AgentTargetInput,
    maybeTarget?: AgentTargetInput
): Promise<string> {
    if (maybeTarget) {
        return agentSystem.agentIdForTarget(
            ctxOrTarget as Context,
            targetNormalize(maybeTarget, ctxOrTarget as Context)
        );
    }
    const target = ctxOrTarget as AgentTargetInput;
    const ctx = await callerCtxResolve(agentSystem, target);
    return agentSystem.agentIdForTarget(ctx, targetNormalize(target, ctx));
}

type AgentTargetInput = AgentPostTarget | { descriptor: AgentDescriptor };

async function callerCtxResolve(agentSystem: AgentSystem, target: AgentTargetInput): Promise<Context> {
    if ("agentId" in target) {
        const targetCtx = await agentSystem.contextForAgentId(target.agentId);
        if (!targetCtx) {
            throw new Error(`Agent not found: ${target.agentId}`);
        }
        return contextForUser({ userId: targetCtx.userId });
    }
    if ("path" in target) {
        const userId = agentPathUserId(target.path);
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
    return { path: agentPathFromDescriptor(target.descriptor, { userId: ctx.userId }) };
}

async function contextForAgentIdRequire(agentSystem: AgentSystem, agentId: string): Promise<Context> {
    const ctx = await agentSystem.contextForAgentId(agentId);
    if (!ctx) {
        throw new Error(`Agent not found: ${agentId}`);
    }
    return ctx;
}

async function signalsBuild(
    _config: unknown,
    eventBus: EngineEventBus,
    onDeliver?: (signal: Signal, subscriptions: SignalSubscription[]) => Promise<void>
): Promise<Signals> {
    const storage = await storageOpenTest();
    return new Signals({
        eventBus,
        observationLog: storage.observationLog,
        signalEvents: storage.signalEvents,
        signalSubscriptions: storage.signalSubscriptions,
        onDeliver
    });
}

async function delayedSignalsBuild(
    config: ConfigModule,
    eventBus: EngineEventBus,
    signals: Signals
): Promise<DelayedSignals> {
    const storage = await storageOpenTest();
    return new DelayedSignals({
        config,
        eventBus,
        signals,
        delayedSignals: storage.delayedSignals
    });
}

function historyHasSignalText(records: Array<{ type: string; text?: string }>): boolean {
    return records.some(
        (record) =>
            record.type === "user_message" && typeof record.text === "string" && record.text.includes("[signal]")
    );
}

async function pendingToolCallSnapshotBuild(): Promise<string> {
    const preamble = montyPreambleBuild([waitToolBuild()]);
    const started = await rlmStepStart({
        workerKey: "test:agent",
        code: "wait(300)",
        preamble,
        externalFunctions: ["wait"],
        limits: RLM_LIMITS,
        printCallback: () => undefined
    });
    if (!("functionName" in started.progress)) {
        throw new Error("Expected Monty to pause at wait() tool call");
    }
    return Buffer.from(started.progress.dump()).toString("base64");
}

function waitToolBuild(): Tool {
    return {
        name: "wait",
        description: "wait tool",
        parameters: Type.Object(
            {
                seconds: Type.Number()
            },
            { additionalProperties: false }
        )
    };
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
