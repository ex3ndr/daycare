import { promises as fs } from "node:fs";

import { createId } from "@paralleldrive/cuid2";
import type {
    AgentConfig,
    AgentModelOverride,
    AgentPath,
    Context,
    DelayedSignalCancelRepeatKeyInput,
    DelayedSignalScheduleInput,
    SessionPermissions,
    Signal,
    SignalSubscription
} from "@/types";
import type { AuthStore } from "../../auth/store.js";
import { getLogger } from "../../log.js";
import type { AgentDbRecord } from "../../storage/databaseTypes.js";
import type { Storage } from "../../storage/storage.js";
import { storageResolve } from "../../storage/storageResolve.js";
import { AsyncLock } from "../../utils/lock.js";
import type { ConfigModule } from "../config/configModule.js";
import type { Crons } from "../cron/crons.js";
import type { EngineEventBus } from "../ipc/events.js";
import type { ConnectorRegistry } from "../modules/connectorRegistry.js";
import type { ImageGenerationRegistry } from "../modules/imageGenerationRegistry.js";
import type { InferenceRouter } from "../modules/inference/router.js";
import type { MediaAnalysisRegistry } from "../modules/mediaAnalysisRegistry.js";
import type { ToolResolver } from "../modules/toolResolver.js";
import type { PluginManager } from "../plugins/manager.js";
import { Secrets } from "../secrets/secrets.js";
import type { Signals } from "../signals/signals.js";
import type { TaskExecutions } from "../tasks/taskExecutions.js";
import { UserHome } from "../users/userHome.js";
import type { Webhooks } from "../webhook/webhooks.js";
import { Agent } from "./agent.js";
import { contextForAgent, contextForUser } from "./context.js";
import { agentHistoryLoad } from "./ops/agentHistoryLoad.js";
import { AgentInbox } from "./ops/agentInbox.js";
import { agentLoopPendingPhaseResolve } from "./ops/agentLoopPendingPhaseResolve.js";
import { agentStateRead } from "./ops/agentStateRead.js";
import { agentStateWrite } from "./ops/agentStateWrite.js";
import { agentTimestampGet } from "./ops/agentTimestampGet.js";
import type {
    AgentCreationConfig,
    AgentFetchStrategy,
    AgentInboxCompletion,
    AgentInboxItem,
    AgentInboxResult,
    AgentInboxSteering,
    AgentPostTarget
} from "./ops/agentTypes.js";
import { inboxItemDeserialize } from "./ops/inboxItemDeserialize.js";
import { inboxItemSerialize } from "./ops/inboxItemSerialize.js";

const logger = getLogger("engine.agent-system");
const AGENT_IDLE_DELAY_MS = 60_000;
const AGENT_IDLE_REPEAT_KEY = "lifecycle-idle";
const AGENT_POISON_PILL_DELAY_MS = 3_600_000;
const AGENT_POISON_PILL_REPEAT_KEY = "lifecycle-poison-pill";

type DelayedSignalsFacade = {
    schedule: (input: DelayedSignalScheduleInput) => Promise<unknown>;
    cancelByRepeatKey: (input: DelayedSignalCancelRepeatKeyInput) => Promise<number>;
};

type AgentEntry = {
    ctx: Context;
    path: AgentPath;
    config: AgentConfig;
    agent: Agent;
    inbox: AgentInbox;
    running: boolean;
    terminating: boolean;
    lock: AsyncLock;
};

export type AgentSystemOptions = {
    config: ConfigModule;
    eventBus: EngineEventBus;
    storage?: Storage;
    connectorRegistry: ConnectorRegistry;
    imageRegistry: ImageGenerationRegistry;
    mediaRegistry: MediaAnalysisRegistry;
    toolResolver: ToolResolver;
    pluginManager: PluginManager;
    inferenceRouter: InferenceRouter;
    authStore: AuthStore;
    secrets?: Secrets;
    delayedSignals?: DelayedSignalsFacade;
    extraMountsForUserId?: (userId: string) => Array<{ hostPath: string; mappedPath: string }>;
};

export class AgentSystem {
    readonly config: ConfigModule;
    readonly eventBus: EngineEventBus;
    readonly storage: Storage;
    readonly connectorRegistry: ConnectorRegistry;
    readonly imageRegistry: ImageGenerationRegistry;
    readonly mediaRegistry: MediaAnalysisRegistry;
    readonly toolResolver: ToolResolver;
    readonly pluginManager: PluginManager;
    readonly inferenceRouter: InferenceRouter;
    readonly authStore: AuthStore;
    readonly secrets: Secrets;
    private readonly delayedSignals: DelayedSignalsFacade | null;
    private extraMountsForUserIdProvider: ((userId: string) => Array<{ hostPath: string; mappedPath: string }>) | null;
    private _crons: Crons | null = null;
    private _webhooks: Webhooks | null = null;
    private _signals: Signals | null = null;
    private _taskExecutions: TaskExecutions | null = null;
    private entries = new Map<string, AgentEntry>();
    private pathMap = new Map<string, string>();
    private stage: "idle" | "loaded" | "running" = "idle";

    constructor(options: AgentSystemOptions) {
        this.config = options.config;
        this.eventBus = options.eventBus;
        this.storage = options.storage ?? storageResolve(this.config.current);
        this.connectorRegistry = options.connectorRegistry;
        this.imageRegistry = options.imageRegistry;
        this.mediaRegistry = options.mediaRegistry;
        this.toolResolver = options.toolResolver;
        this.pluginManager = options.pluginManager;
        this.inferenceRouter = options.inferenceRouter;
        this.authStore = options.authStore;
        this.secrets =
            options.secrets ??
            new Secrets({
                usersDir: this.config.current.usersDir,
                observationLog: this.storage.observationLog
            });
        this.delayedSignals = options.delayedSignals ?? null;
        this.extraMountsForUserIdProvider = options.extraMountsForUserId ?? null;
        this.eventBus.onEvent((event) => {
            if (event.type !== "signal.generated") {
                return;
            }
            const signal = event.payload as Signal;
            const parts = signal.type.split(":");
            if (parts.length !== 3) {
                return;
            }
            const [prefix, parsedAgentId, suffix] = parts;
            if (prefix !== "agent" || suffix !== "poison-pill") {
                return;
            }
            const agentId = parsedAgentId?.trim() ?? "";
            if (!agentId) {
                return;
            }
            void this.handlePoisonPill(agentId).catch((error) => {
                logger.warn({ agentId, error }, "error: Poison-pill handling failed");
            });
        });
    }

    get crons(): Crons {
        if (!this._crons) {
            throw new Error("Crons not set");
        }
        return this._crons;
    }

    setCrons(crons: Crons): void {
        this._crons = crons;
    }

    get webhooks(): Webhooks {
        if (!this._webhooks) {
            throw new Error("Webhooks not set");
        }
        return this._webhooks;
    }

    setWebhooks(webhooks: Webhooks): void {
        this._webhooks = webhooks;
    }

    get signals(): Signals {
        if (!this._signals) {
            throw new Error("Signals not set");
        }
        return this._signals;
    }

    setSignals(signals: Signals): void {
        this._signals = signals;
    }

    get taskExecutions(): TaskExecutions {
        if (!this._taskExecutions) {
            throw new Error("TaskExecutions not set");
        }
        return this._taskExecutions;
    }

    setTaskExecutions(taskExecutions: TaskExecutions): void {
        this._taskExecutions = taskExecutions;
    }

    async load(): Promise<void> {
        if (this.stage !== "idle") {
            return;
        }
        await fs.mkdir(this.config.current.dataDir, { recursive: true });
        const records = await this.storage.agents.findMany();

        for (const record of records) {
            const agentId = record.id;
            const ctx = contextForAgent({ userId: record.userId, agentId });
            let state: Awaited<ReturnType<typeof agentStateRead>> = null;
            try {
                state = await agentStateRead(this.storage, ctx);
            } catch (error) {
                logger.warn({ agentId, error }, "restore: Agent restore skipped due to invalid persisted data");
                continue;
            }
            if (!state) {
                continue;
            }
            const path = record.path;
            const config = agentConfigFromRecord(record);
            if (state.state === "dead") {
                await this.cancelPoisonPill(agentId, { kind: config.kind });
                logger.info({ agentId }, "restore: Agent restore skipped (dead)");
                continue;
            }
            if (state.state === "sleeping") {
                const kind = config.kind;
                if (kind === "sub" || kind === "search") {
                    await this.schedulePoisonPill(agentId, {
                        kind,
                        deliverAt: state.updatedAt + AGENT_POISON_PILL_DELAY_MS
                    });
                }
                this.pathMap.set(path, agentId);
                logger.info({ agentId }, "restore: Agent restore skipped (sleeping)");
                continue;
            }
            const inbox = new AgentInbox(agentId);
            const userHome = this.userHomeForUserId(record.userId);
            const agent = Agent.restore(ctx, path, config, state, inbox, this, userHome);
            const registered = this.registerEntry({
                ctx,
                path,
                config,
                agent,
                inbox
            });
            registered.inbox.post({ type: "restore" }, null, { front: true });
            await this.replayPersistedInboxItems(registered);
            logger.info({ agentId }, "restore: Agent restored");
            this.startEntryIfRunning(registered);
        }

        this.stage = "loaded";
    }

    async start(): Promise<void> {
        if (this.stage === "running") {
            return;
        }
        if (this.stage === "idle") {
            throw new Error("AgentSystem must load before starting");
        }
        this.stage = "running";
        for (const entry of this.entries.values()) {
            this.startEntryIfRunning(entry);
        }
    }

    async post(
        ctx: Context,
        target: AgentPostTarget,
        item: AgentInboxItem,
        creationConfig?: AgentCreationConfig
    ): Promise<void> {
        if (this.stage === "idle" && (item.type === "message" || item.type === "system_message")) {
            const agentType = "path" in target ? "path" : "agent";
            logger.warn({ agentType }, "load: AgentSystem received message before load");
        }
        if ("path" in target && !creationConfig) {
            logger.warn(
                { path: target.path },
                "prefer: Path target posted without creationConfig; using existing agent only"
            );
        }
        const targetLabel = "path" in target ? `path:${target.path}` : `agent:${target.agentId}`;
        logger.debug(`receive: post() received itemType=${item.type} target=${targetLabel} stage=${this.stage}`);
        const entry = await this.resolveEntry(ctx, target, item, creationConfig);
        await this.enqueueEntry(entry, item, null);
        logger.debug(`event: post() queued item agentId=${entry.ctx.agentId} inboxSize=${entry.inbox.size()}`);
        this.startEntryIfRunning(entry);
    }

    async postAndAwait(
        ctx: Context,
        target: AgentPostTarget,
        item: AgentInboxItem,
        creationConfig?: AgentCreationConfig
    ): Promise<AgentInboxResult> {
        if ("path" in target && !creationConfig) {
            logger.warn(
                { path: target.path },
                "prefer: Path target posted without creationConfig; using existing agent only"
            );
        }
        const entry = await this.resolveEntry(ctx, target, item, creationConfig);
        const completion = this.createCompletion();
        await this.enqueueEntry(entry, item, completion.completion);
        this.startEntryIfRunning(entry);
        return completion.promise;
    }

    /**
     * Posts an inbox item to all user-facing agents owned by a specific user.
     * Expects: targetUserId is an internal user id.
     */
    async postToUserAgents(targetUserId: string, item: AgentInboxItem): Promise<void> {
        const records = await this.storage.agents.findByUserId(targetUserId);
        const frontendAgents = records.filter((record) => record.foreground);
        await Promise.all(
            frontendAgents.map(async (record) => {
                const targetCtx = contextForAgent({ userId: targetUserId, agentId: record.id });
                await this.post(targetCtx, { agentId: record.id }, item);
            })
        );
    }

    /**
     * Resolves a target to its concrete agent id, creating/restoring when needed.
     * Expects: path targets are valid for agent creation.
     */
    async agentIdForTarget(
        ctx: Context,
        target: AgentPostTarget,
        creationConfig?: AgentCreationConfig
    ): Promise<string> {
        const entry = await this.resolveEntry(
            ctx,
            target,
            {
                type: "message",
                message: { text: null },
                context: {}
            },
            creationConfig
        );
        return entry.ctx.agentId;
    }

    async agentExists(agentId: string): Promise<boolean> {
        if (this.entries.has(agentId)) {
            return true;
        }
        const context = await this.contextForAgentId(agentId);
        return context !== null;
    }

    /**
     * Reads agent + user identity by agent id.
     * Returns: null when the agent does not exist in memory or storage.
     */
    async contextForAgentId(agentId: string): Promise<Context | null> {
        const loaded = this.entries.get(agentId);
        if (loaded) {
            return loaded.ctx;
        }
        const record = await this.storage.agents.findById(agentId);
        if (!record) {
            return null;
        }
        return contextForAgent({ userId: record.userId, agentId: record.id });
    }

    async signalDeliver(signal: Signal, subscriptions: SignalSubscription[]): Promise<void> {
        await Promise.all(
            subscriptions.map(async (subscription) => {
                if (signal.source.type === "agent" && signal.source.id === subscription.ctx.agentId) {
                    return;
                }
                const context = await this.contextForAgentId(subscription.ctx.agentId);
                if (!context || context.userId !== subscription.ctx.userId) {
                    return;
                }
                try {
                    await this.post(
                        context,
                        { agentId: subscription.ctx.agentId },
                        {
                            type: "signal",
                            signal,
                            subscriptionPattern: subscription.pattern
                        }
                    );
                } catch (error) {
                    logger.warn(
                        {
                            signalId: signal.id,
                            signalType: signal.type,
                            agentId: subscription.ctx.agentId,
                            pattern: subscription.pattern,
                            error
                        },
                        "skip: Signal delivery skipped"
                    );
                }
            })
        );
    }

    /**
     * Delivers a steering message to an agent, interrupting its current work.
     * The current tool completes but remaining queued tools are cancelled.
     * Wakes the agent if sleeping.
     */
    async steer(ctx: Context, agentId: string, steering: AgentInboxSteering): Promise<void> {
        const entry = this.entries.get(agentId);
        if (!entry) {
            throw new Error(`Agent not found: ${agentId}`);
        }
        if (ctx.userId !== entry.ctx.userId) {
            throw new Error(`Cannot steer agent from another user: ${agentId}`);
        }
        let woke = false;
        await entry.lock.inLock(async () => {
            woke = await this.wakeEntryIfSleeping(entry);
            entry.inbox.steer(steering);
        });
        if (woke) {
            await this.signalLifecycle(entry.ctx.agentId, "wake");
        }
        logger.info({ agentId, origin: steering.origin }, "event: Steering message delivered");
        this.startEntryIfRunning(entry);
    }

    /**
     * Aborts the active inference call for a loaded agent target.
     * Returns false when the target is not loaded or has no active inference.
     */
    abortInferenceForTarget(target: AgentPostTarget): boolean {
        const entry = this.findLoadedEntry(target);
        if (!entry) {
            return false;
        }
        const aborted = entry.agent.abortInference();
        logger.info({ agentId: entry.ctx.agentId, aborted }, "event: Abort inference requested");
        return aborted;
    }

    markStopped(agentId: string, error?: unknown): void {
        const entry = this.entries.get(agentId);
        if (!entry) {
            logger.warn({ agentId }, "stop: Agent stop reported for unknown agent");
            return;
        }
        entry.running = false;
        logger.debug({ agentId, error }, "stop: Agent marked stopped");
    }

    async sleepIfIdle(
        agentId: string,
        reason: "message" | "system_message" | "signal" | "reset" | "compact" | "restore"
    ): Promise<void> {
        const entry = this.entries.get(agentId);
        if (!entry) {
            return;
        }
        let slept = false;
        await entry.lock.inLock(async () => {
            if (entry.inbox.size() > 0) {
                return;
            }
            if (entry.agent.state.state === "sleeping") {
                return;
            }
            entry.agent.state.state = "sleeping";
            await agentStateWrite(this.storage, entry.ctx, entry.agent.state);
            this.eventBus.emit("agent.sleep", { agentId, reason });
            logger.debug({ agentId, reason }, "event: Agent entered sleep mode");
            // Mark session for memory processing on idle
            // Memory-agents must never trigger the memory worker
            const kind = entry.config.kind ?? "agent";
            if (kind !== "memory" && kind !== "search") {
                const sessionId = entry.agent.state.activeSessionId;
                if (sessionId) {
                    const maxHistoryId = await this.storage.history.maxId(sessionId);
                    if (maxHistoryId !== null) {
                        await this.storage.sessions.invalidate(sessionId, maxHistoryId);
                    }
                }
            }
            // Keep sleep->idle scheduling under the same lock as wake->cancel to avoid
            // interleaving that could leave stale idle lifecycle signals behind.
            await this.scheduleIdleSignal(agentId);
            await this.schedulePoisonPill(agentId, { kind });
            slept = true;
        });
        if (slept) {
            await this.signalLifecycle(agentId, "sleep");
        }
    }

    agentFor(ctx: Context, strategy: AgentFetchStrategy): string | null {
        const candidates = Array.from(this.entries.values()).filter((entry) => {
            return entry.ctx.userId === ctx.userId && agentMatchesStrategy(entry.config, strategy);
        });
        if (candidates.length === 0) {
            return null;
        }
        candidates.sort((a, b) => {
            const aConnector = a.config.connectorName;
            const bConnector = b.config.connectorName;
            const aKind = a.config.kind ?? "agent";
            const bKind = b.config.kind ?? "agent";
            const aPrefix = aConnector
                ? aConnector === "telegram"
                    ? "aa-telegram"
                    : "bb-user"
                : aKind === "swarm"
                  ? "cc-swarm"
                  : "zz-other";
            const bPrefix = bConnector
                ? bConnector === "telegram"
                    ? "aa-telegram"
                    : "bb-user"
                : bKind === "swarm"
                  ? "cc-swarm"
                  : "zz-other";
            if (aPrefix !== bPrefix) {
                return aPrefix.localeCompare(bPrefix);
            }

            const aStateRank = a.agent.state.state === "active" ? 0 : a.agent.state.state === "sleeping" ? 1 : 2;
            const bStateRank = b.agent.state.state === "active" ? 0 : b.agent.state.state === "sleeping" ? 1 : 2;
            if (aStateRank !== bStateRank) {
                return aStateRank - bStateRank;
            }

            const aTime = agentTimestampGet(a.agent.state.updatedAt);
            const bTime = agentTimestampGet(b.agent.state.updatedAt);
            return bTime - aTime;
        });
        return candidates[0]?.ctx.agentId ?? null;
    }

    /**
     * Returns path identity for a loaded agent by id.
     * Returns null when agent is not loaded.
     */
    getAgentPath(agentId: string): AgentPath | null {
        const entry = this.entries.get(agentId);
        return entry?.path ?? null;
    }

    /**
     * Returns config metadata for a loaded agent by id.
     * Returns null when agent is not loaded.
     */
    getAgentConfig(agentId: string): AgentConfig | null {
        const entry = this.entries.get(agentId);
        return entry?.config ?? null;
    }

    /**
     * Updates loaded agent config metadata in memory.
     * Expects: caller persisted config change to storage when required.
     */
    updateAgentConfig(agentId: string, config: Partial<AgentConfig>): void {
        const entry = this.entries.get(agentId);
        if (!entry) {
            return;
        }
        entry.config = { ...entry.config, ...config };
        Object.assign(entry.agent.config, entry.config);
    }

    /**
     * Updates a loaded agent's permissions in memory.
     * Expects: permissions have already been persisted if needed.
     */
    updateAgentPermissions(agentId: string, permissions: SessionPermissions, updatedAt: number): void {
        const entry = this.entries.get(agentId);
        if (!entry) {
            return;
        }
        const current = entry.agent.state.permissions;
        current.workingDir = permissions.workingDir;
        current.writeDirs = [...permissions.writeDirs];
        current.readDirs = [...(permissions.readDirs ?? [])];
        entry.agent.state.updatedAt = updatedAt;
    }

    /**
     * Updates a loaded agent's model override in memory and persists it.
     * Returns false when the agent is not loaded.
     */
    async updateAgentModelOverride(agentId: string, override: AgentModelOverride | null): Promise<boolean> {
        const entry = this.entries.get(agentId);
        if (!entry) {
            return false;
        }
        entry.agent.state.modelOverride = override;
        entry.agent.state.updatedAt = Date.now();
        await agentStateWrite(this.storage, entry.ctx, entry.agent.state);
        return true;
    }

    async inReadLock<T>(operation: () => Promise<T>): Promise<T> {
        return this.config.inReadLock(operation);
    }

    async deleteInboxItem(id: string): Promise<void> {
        await this.storage.inbox.delete(id);
    }

    private findLoadedEntry(target: AgentPostTarget): AgentEntry | null {
        if ("agentId" in target) {
            return this.entries.get(target.agentId) ?? null;
        }
        const agentId = this.pathMap.get(target.path);
        if (!agentId) {
            return null;
        }
        return this.entries.get(agentId) ?? null;
    }

    private async resolveEntry(
        ctx: Context,
        target: AgentPostTarget,
        _item: AgentInboxItem,
        creationConfig?: AgentCreationConfig
    ): Promise<AgentEntry> {
        if ("agentId" in target) {
            const existing = this.entries.get(target.agentId);
            if (existing) {
                if (existing.agent.state.state === "dead" || existing.terminating) {
                    throw new Error(`Agent is dead: ${target.agentId}`);
                }
                if (existing.ctx.userId !== ctx.userId) {
                    throw new Error(`Cannot post to agent from another user: ${target.agentId}`);
                }
                return existing;
            }
            const restored = await this.restoreAgent(target.agentId, { allowSleeping: true });
            if (restored) {
                if (restored.ctx.userId !== ctx.userId) {
                    throw new Error(`Cannot post to agent from another user: ${target.agentId}`);
                }
                return restored;
            }
            throw new Error(`Agent not found: ${target.agentId}`);
        }

        const path = target.path;
        const existing = await this.pathEntryResolve(ctx, path);
        if (existing) {
            return existing;
        }
        if (!creationConfig) {
            throw new Error(`Agent not found for path: ${path}`);
        }
        const config = configForCreation(path, creationConfig);
        const agentId = createId();
        logger.debug(`event: Creating agent entry agentId=${agentId} path=${path} kind=${config.kind}`);
        const inbox = new AgentInbox(agentId);
        const userId = await this.resolveUserIdForPath(ctx, path);
        if (userId !== ctx.userId) {
            throw new Error(`Cannot create agent for another user: ${agentId}`);
        }
        const createdCtx = contextForAgent({ userId, agentId });
        const userHome = this.userHomeForCtx(createdCtx);
        const agent = await Agent.create(createdCtx, path, config, inbox, this, userHome);
        const persisted = await this.storage.agents.findById(agentId);
        const entry = this.registerEntry({
            ctx: createdCtx,
            path: persisted?.path ?? path,
            config: persisted ? agentConfigFromRecord(persisted) : config,
            agent,
            inbox
        });
        logger.debug(`register: Agent entry registered agentId=${agentId}`);
        return entry;
    }

    /**
     * Resolves an existing path-targeted agent from memory or persisted storage.
     * Returns null when no existing agent is found for the path.
     */
    private async pathEntryResolve(ctx: Context, path: AgentPath): Promise<AgentEntry | null> {
        const existingAgentId = this.pathMap.get(path);
        if (existingAgentId) {
            const existing = this.entries.get(existingAgentId);
            if (existing) {
                if (existing.agent.state.state === "dead" || existing.terminating) {
                    throw new Error(`Agent is dead: ${existingAgentId}`);
                }
                if (existing.ctx.userId !== ctx.userId) {
                    throw new Error(`Cannot resolve agent from another user: ${existingAgentId}`);
                }
                return existing;
            }
            const restored = await this.restoreAgent(existingAgentId, { allowSleeping: true });
            if (restored) {
                if (restored.ctx.userId !== ctx.userId) {
                    throw new Error(`Cannot resolve agent from another user: ${existingAgentId}`);
                }
                return restored;
            }
        }

        const persistedByPath = await this.storage.agents.findByPath(path);
        if (!persistedByPath) {
            return null;
        }
        const restored = await this.restoreAgent(persistedByPath.id, { allowSleeping: true });
        if (restored) {
            if (restored.ctx.userId !== ctx.userId) {
                throw new Error(`Cannot resolve agent from another user: ${persistedByPath.id}`);
            }
            return restored;
        }
        return null;
    }

    private registerEntry(input: {
        ctx: Context;
        path: AgentPath;
        config: AgentConfig;
        agent: Agent;
        inbox: AgentInbox;
    }): AgentEntry {
        const entry: AgentEntry = {
            ctx: input.ctx,
            path: input.path,
            config: input.config,
            agent: input.agent,
            inbox: input.inbox,
            running: false,
            terminating: false,
            lock: new AsyncLock()
        };
        this.entries.set(input.ctx.agentId, entry);
        this.pathMap.set(input.path, input.ctx.agentId);
        return entry;
    }

    private startEntryIfRunning(entry: AgentEntry): void {
        if (this.stage !== "running") {
            logger.debug(`skip: startEntryIfRunning skipped agentId=${entry.ctx.agentId} reason=stage:${this.stage}`);
            return;
        }
        if (entry.running) {
            logger.debug(`skip: startEntryIfRunning skipped agentId=${entry.ctx.agentId} reason=already-running`);
            return;
        }
        logger.debug(
            `start: startEntryIfRunning starting agentId=${entry.ctx.agentId} kind=${entry.config.kind ?? "agent"}`
        );
        entry.running = true;
        entry.agent.start();
    }

    private async enqueueEntry(
        entry: AgentEntry,
        item: AgentInboxItem,
        completion: AgentInboxCompletion | null
    ): Promise<void> {
        let woke = false;
        await entry.lock.inLock(async () => {
            woke = await this.wakeEntryIfSleeping(entry);
            const postedAt = Date.now();
            const generatedId = createId();
            await this.storage.inbox.insert(
                generatedId,
                entry.ctx.agentId,
                postedAt,
                item.type,
                inboxItemSerialize(item)
            );
            const queued = entry.inbox.post(item, completion, { id: generatedId, postedAt });

            if (queued.id !== generatedId) {
                // Message merge consumed the new row into an existing queue entry.
                await this.storage.inbox.delete(generatedId);
                await this.storage.inbox.insert(
                    queued.id,
                    entry.ctx.agentId,
                    queued.postedAt,
                    queued.item.type,
                    inboxItemSerialize(queued.item)
                );
            }
        });
        if (woke) {
            await this.signalLifecycle(entry.ctx.agentId, "wake");
        }
    }

    private async replayPersistedInboxItems(entry: AgentEntry): Promise<void> {
        await entry.lock.inLock(async () => {
            let rows = await this.storage.inbox.findByAgentId(entry.ctx.agentId);
            if (rows.length > 0) {
                const history = await agentHistoryLoad(this.storage, entry.ctx);
                const pendingPhase = agentLoopPendingPhaseResolve(history);
                if (pendingPhase) {
                    const staleInFlight = rows[0];
                    if (staleInFlight) {
                        await this.storage.inbox.delete(staleInFlight.id);
                        rows = rows.slice(1);
                        logger.warn(
                            {
                                agentId: entry.ctx.agentId,
                                droppedInboxItemId: staleInFlight.id,
                                pendingPhase: pendingPhase.type
                            },
                            "restore: Dropped stale in-flight inbox row after pending phase recovery"
                        );
                    }
                }
            }
            for (const row of rows) {
                try {
                    const item = inboxItemDeserialize(row.data);
                    entry.inbox.post(item, null, { id: row.id, postedAt: row.postedAt, merge: false });
                } catch (error) {
                    logger.warn(
                        { agentId: entry.ctx.agentId, inboxItemId: row.id, error },
                        "restore: Dropping invalid persisted inbox row"
                    );
                    await this.storage.inbox.delete(row.id);
                }
            }
        });
    }

    private async wakeEntryIfSleeping(entry: AgentEntry): Promise<boolean> {
        if (entry.agent.state.state !== "sleeping") {
            return false;
        }
        await this.cancelIdleSignal(entry.ctx.agentId);
        await this.cancelPoisonPill(entry.ctx.agentId, { kind: entry.config.kind });
        entry.agent.state.state = "active";
        await agentStateWrite(this.storage, entry.ctx, entry.agent.state);
        this.eventBus.emit("agent.woke", { agentId: entry.ctx.agentId });
        logger.debug({ agentId: entry.ctx.agentId }, "event: Agent woke from sleep");
        return true;
    }

    private async scheduleIdleSignal(agentId: string): Promise<void> {
        if (!this.delayedSignals) {
            return;
        }
        const context = await this.contextForAgentId(agentId);
        if (!context) {
            return;
        }
        const deliverAt = Date.now() + AGENT_IDLE_DELAY_MS;
        const type = `agent:${agentId}:idle`;
        try {
            await this.delayedSignals.schedule({
                type,
                deliverAt,
                source: { type: "agent", id: agentId, userId: context.userId },
                data: { agentId, state: "idle" },
                repeatKey: AGENT_IDLE_REPEAT_KEY
            });
        } catch (error) {
            logger.warn({ agentId, error }, "error: Failed to schedule idle lifecycle signal");
        }
    }

    private async cancelIdleSignal(agentId: string): Promise<void> {
        if (!this.delayedSignals) {
            return;
        }
        try {
            await this.delayedSignals.cancelByRepeatKey({
                type: `agent:${agentId}:idle`,
                repeatKey: AGENT_IDLE_REPEAT_KEY
            });
        } catch (error) {
            logger.warn({ agentId, error }, "error: Failed to cancel idle lifecycle signal");
        }
    }

    private async schedulePoisonPill(
        agentId: string,
        options?: { kind?: AgentConfig["kind"]; deliverAt?: number }
    ): Promise<void> {
        if (!this.delayedSignals) {
            return;
        }
        const kind = options?.kind ?? this.entries.get(agentId)?.config.kind ?? null;
        if (kind !== "sub" && kind !== "search") {
            return;
        }
        const context = await this.contextForAgentId(agentId);
        if (!context) {
            return;
        }
        try {
            // load() runs before DelayedSignals.start(); ensure persistence directory exists.
            await fs.mkdir(`${this.config.current.configDir}/signals`, { recursive: true });
            await this.delayedSignals.schedule({
                type: `agent:${agentId}:poison-pill`,
                deliverAt: options?.deliverAt ?? Date.now() + AGENT_POISON_PILL_DELAY_MS,
                source: { type: "agent", id: agentId, userId: context.userId },
                data: { agentId, state: "poison-pill" },
                repeatKey: AGENT_POISON_PILL_REPEAT_KEY
            });
        } catch (error) {
            logger.warn({ agentId, error }, "error: Failed to schedule poison-pill signal");
        }
    }

    private async cancelPoisonPill(agentId: string, options?: { kind?: AgentConfig["kind"] }): Promise<void> {
        if (!this.delayedSignals) {
            return;
        }
        const kind = options?.kind ?? this.entries.get(agentId)?.config.kind ?? null;
        if (kind !== "sub" && kind !== "search") {
            return;
        }
        try {
            await this.delayedSignals.cancelByRepeatKey({
                type: `agent:${agentId}:poison-pill`,
                repeatKey: AGENT_POISON_PILL_REPEAT_KEY
            });
        } catch (error) {
            logger.warn({ agentId, error }, "error: Failed to cancel poison-pill signal");
        }
    }

    private async signalLifecycle(agentId: string, state: "wake" | "sleep"): Promise<void> {
        if (!this._signals) {
            return;
        }
        const context = await this.contextForAgentId(agentId);
        if (!context) {
            return;
        }
        try {
            await this._signals.generate({
                type: `agent:${agentId}:${state}`,
                source: { type: "agent", id: agentId, userId: context.userId },
                data: { agentId, state }
            });
        } catch (error) {
            logger.warn({ agentId, state, error }, "error: Failed to emit lifecycle signal");
        }
    }

    private async handlePoisonPill(agentId: string): Promise<void> {
        const entry = this.entries.get(agentId);
        if (entry) {
            const entryKind = entry.config.kind ?? "agent";
            if (entryKind !== "sub" && entryKind !== "search") {
                return;
            }
            if (entry.agent.state.state === "dead") {
                return;
            }
            if (entry.agent.state.state === "active") {
                entry.terminating = true;
                try {
                    const completion = this.createCompletion();
                    await this.enqueueEntry(
                        entry,
                        {
                            type: "system_message",
                            text: "You have been terminated due to inactivity. Stop all work immediately.",
                            origin: "system:poison-pill"
                        },
                        completion.completion
                    );
                    this.startEntryIfRunning(entry);
                    await completion.promise;
                } catch (error) {
                    logger.warn({ agentId, error }, "error: Failed to deliver poison-pill system message");
                }
            }
            await this.markEntryDead(entry, "poison-pill");
            return;
        }

        let kind: AgentDbRecord["kind"] | null = null;
        let state: Awaited<ReturnType<typeof agentStateRead>> = null;
        try {
            const context = await this.contextForAgentId(agentId);
            if (!context) {
                return;
            }
            const persisted = await this.storage.agents.findById(agentId);
            kind = persisted?.kind ?? null;
            state = await agentStateRead(this.storage, context);
        } catch (error) {
            logger.warn({ agentId, error }, "error: Poison-pill read failed");
            return;
        }
        if (!state || (kind !== "sub" && kind !== "search")) {
            return;
        }
        if (state.state === "dead") {
            return;
        }
        await this.cancelPoisonPill(agentId, { kind });
        state.state = "dead";
        state.updatedAt = Date.now();
        const context = await this.contextForAgentId(agentId);
        if (!context) {
            return;
        }
        await agentStateWrite(this.storage, context, state);
        await this.storage.inbox.deleteByAgentId(agentId);
        this.eventBus.emit("agent.dead", { agentId, reason: "poison-pill" });
    }

    private async markEntryDead(entry: AgentEntry, reason: "poison-pill"): Promise<void> {
        entry.terminating = true;
        let pending = entry.inbox.listPending();
        let changed = false;
        await entry.lock.inLock(async () => {
            if (entry.agent.state.state === "dead") {
                pending = [];
                return;
            }
            await this.cancelIdleSignal(entry.ctx.agentId);
            await this.cancelPoisonPill(entry.ctx.agentId, { kind: entry.config.kind });
            entry.agent.state.state = "dead";
            entry.agent.state.updatedAt = Date.now();
            await agentStateWrite(this.storage, entry.ctx, entry.agent.state);
            pending = entry.inbox.drainPending();
            await this.storage.inbox.deleteByAgentId(entry.ctx.agentId);
            changed = true;
        });
        if (!changed) {
            return;
        }
        entry.running = false;
        this.entries.delete(entry.ctx.agentId);
        this.pathMap.delete(entry.path);
        const deadError = new Error(`Agent is dead: ${entry.ctx.agentId}`);
        for (const queued of pending) {
            queued.completion?.reject(deadError);
        }
        this.eventBus.emit("agent.dead", { agentId: entry.ctx.agentId, reason });
    }

    private async restoreAgent(agentId: string, options?: { allowSleeping?: boolean }): Promise<AgentEntry | null> {
        let state: Awaited<ReturnType<typeof agentStateRead>> = null;
        let ctx: Context | null = null;
        const persisted = await this.storage.agents.findById(agentId);
        try {
            ctx = await this.contextForAgentId(agentId);
            if (!ctx) {
                return null;
            }
            state = await agentStateRead(this.storage, ctx);
        } catch (error) {
            logger.warn({ agentId, error }, "error: Agent restore failed due to invalid persisted data");
            return null;
        }
        if (!persisted || !state || !ctx) {
            return null;
        }
        if (state.state === "dead") {
            throw new Error(`Agent is dead: ${agentId}`);
        }
        if (state.state === "sleeping" && !options?.allowSleeping) {
            return null;
        }
        const inbox = new AgentInbox(agentId);
        const userHome = this.userHomeForCtx(ctx);
        const config = agentConfigFromRecord(persisted);
        const agent = Agent.restore(ctx, persisted.path, config, state, inbox, this, userHome);
        const entry = this.registerEntry({
            ctx,
            path: persisted.path,
            config,
            agent,
            inbox
        });
        entry.inbox.post({ type: "restore" }, null, { front: true });
        await this.replayPersistedInboxItems(entry);
        this.startEntryIfRunning(entry);
        return entry;
    }

    private async resolveUserIdForPath(ctx: Context, _path: AgentPath): Promise<string> {
        return ctx.userId;
    }

    async ownerCtxEnsure(): Promise<Context> {
        const owner = await this.storage.users.findOwner();
        if (owner) {
            return contextForUser({ userId: owner.id });
        }
        const now = Date.now();
        const ownerId = createId();
        try {
            await this.storage.users.create({
                id: ownerId,
                isOwner: true,
                createdAt: now,
                updatedAt: now
            });
            return contextForUser({ userId: ownerId });
        } catch {
            const recovered = await this.storage.users.findOwner();
            if (recovered) {
                return contextForUser({ userId: recovered.id });
            }
            throw new Error("Failed to resolve owner user");
        }
    }

    /**
     * Resolves a UserHome facade for a concrete user id.
     * Expects: userId belongs to an existing or soon-to-be-created runtime user.
     */
    userHomeForUserId(userId: string): UserHome {
        return new UserHome(this.config.current.usersDir, userId);
    }

    /**
     * Resolves a UserHome facade from caller context.
     * Expects: ctx.userId belongs to an existing or soon-to-be-created runtime user.
     */
    userHomeForCtx(ctx: Context): UserHome {
        return this.userHomeForUserId(ctx.userId);
    }

    extraMountsForUserId(userId: string): Array<{ hostPath: string; mappedPath: string }> {
        if (!this.extraMountsForUserIdProvider) {
            return [];
        }
        return this.extraMountsForUserIdProvider(userId);
    }

    setExtraMountsForUserId(
        provider: ((userId: string) => Array<{ hostPath: string; mappedPath: string }>) | null
    ): void {
        this.extraMountsForUserIdProvider = provider;
    }

    /**
     * Rebuilds sandboxes for loaded agents of a specific user.
     * Expects: mount provider already reflects the latest external mounts.
     */
    refreshSandboxesForUserId(userId: string): number {
        let refreshed = 0;
        for (const entry of this.entries.values()) {
            if (entry.ctx.userId !== userId) {
                continue;
            }
            entry.agent.sandboxRefresh();
            refreshed += 1;
        }
        return refreshed;
    }

    private createCompletion(): {
        promise: Promise<AgentInboxResult>;
        completion: {
            resolve: (result: AgentInboxResult) => void;
            reject: (error: Error) => void;
        };
    } {
        let resolve: ((result: AgentInboxResult) => void) | null = null;
        let reject: ((error: Error) => void) | null = null;
        const promise = new Promise<AgentInboxResult>((res, rej) => {
            resolve = res;
            reject = rej;
        });
        return {
            promise,
            completion: {
                resolve: (result) => resolve?.(result),
                reject: (error) => reject?.(error)
            }
        };
    }
}

function agentConfigFromRecord(
    record: Pick<
        AgentDbRecord,
        | "kind"
        | "modelRole"
        | "connectorName"
        | "parentAgentId"
        | "foreground"
        | "name"
        | "description"
        | "systemPrompt"
        | "workspaceDir"
    >
): AgentConfig {
    return {
        kind: record.kind,
        modelRole: record.modelRole,
        connectorName: record.connectorName,
        parentAgentId: record.parentAgentId,
        foreground: record.foreground,
        name: record.name,
        description: record.description,
        systemPrompt: record.systemPrompt,
        workspaceDir: record.workspaceDir
    };
}

function configForCreation(
    path: AgentPath,
    creationConfig?: AgentCreationConfig
): AgentConfig & { kind: NonNullable<AgentConfig["kind"]> } {
    const kind = creationConfig?.kind;
    if (!kind) {
        throw new Error(`Missing creationConfig.kind for new agent path: ${path}`);
    }
    return {
        kind,
        modelRole: creationConfig.modelRole === undefined ? modelRoleForKind(kind) : creationConfig.modelRole,
        connectorName: creationConfig.connectorName === undefined ? null : creationConfig.connectorName,
        parentAgentId: creationConfig.parentAgentId === undefined ? null : creationConfig.parentAgentId,
        foreground: creationConfig.foreground ?? (kind === "connector" || kind === "swarm"),
        name: creationConfig.name ?? null,
        description: creationConfig.description ?? null,
        systemPrompt: creationConfig.systemPrompt ?? null,
        workspaceDir: creationConfig.workspaceDir ?? null
    };
}

function modelRoleForKind(kind: NonNullable<AgentConfig["kind"]>): AgentConfig["modelRole"] {
    if (kind === "connector" || kind === "agent" || kind === "subuser" || kind === "swarm") {
        return "user";
    }
    if (kind === "sub") {
        return "subagent";
    }
    if (kind === "memory") {
        return "memory";
    }
    if (kind === "search") {
        return "memorySearch";
    }
    if (kind === "task") {
        return "task";
    }
    return null;
}

function agentMatchesStrategy(config: AgentConfig, strategy: AgentFetchStrategy): boolean {
    if (strategy !== "most-recent-foreground") {
        return false;
    }
    return config.foreground || config.kind === "swarm";
}
