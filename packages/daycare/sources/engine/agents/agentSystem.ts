import { promises as fs } from "node:fs";

import { createId } from "@paralleldrive/cuid2";
import type {
    AgentModelOverride,
    AgentTokenEntry,
    Context,
    DelayedSignalCancelRepeatKeyInput,
    DelayedSignalScheduleInput,
    SessionPermissions,
    Signal,
    SignalSubscription
} from "@/types";
import type { AuthStore } from "../../auth/store.js";
import { getLogger } from "../../log.js";
import type { Storage } from "../../storage/storage.js";
import { storageResolve } from "../../storage/storageResolve.js";
import { userConnectorKeyCreate } from "../../storage/userConnectorKeyCreate.js";
import { AsyncLock } from "../../util/lock.js";
import { cuid2Is } from "../../utils/cuid2Is.js";
import type { ConfigModule } from "../config/configModule.js";
import type { Crons } from "../cron/crons.js";
import type { Heartbeats } from "../heartbeat/heartbeats.js";
import type { EngineEventBus } from "../ipc/events.js";
import { Memory } from "../memory/memory.js";
import type { ConnectorRegistry } from "../modules/connectorRegistry.js";
import type { ImageGenerationRegistry } from "../modules/imageGenerationRegistry.js";
import type { InferenceRouter } from "../modules/inference/router.js";
import type { ToolResolver } from "../modules/toolResolver.js";
import type { PluginManager } from "../plugins/manager.js";
import type { Signals } from "../signals/signals.js";
import { UserHome } from "../users/userHome.js";
import { Agent } from "./agent.js";
import { contextForAgent, contextForUser } from "./context.js";
import { agentDescriptorCacheKey } from "./ops/agentDescriptorCacheKey.js";
import { agentDescriptorMatchesStrategy } from "./ops/agentDescriptorMatchesStrategy.js";
import { agentDescriptorRead } from "./ops/agentDescriptorRead.js";
import type { AgentDescriptor, AgentFetchStrategy } from "./ops/agentDescriptorTypes.js";
import { AgentInbox } from "./ops/agentInbox.js";
import { agentStateRead } from "./ops/agentStateRead.js";
import { agentStateWrite } from "./ops/agentStateWrite.js";
import { agentTimestampGet } from "./ops/agentTimestampGet.js";
import type {
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
    descriptor: AgentDescriptor;
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
    toolResolver: ToolResolver;
    pluginManager: PluginManager;
    inferenceRouter: InferenceRouter;
    authStore: AuthStore;
    memory?: Memory;
    delayedSignals?: DelayedSignalsFacade;
};

export class AgentSystem {
    readonly config: ConfigModule;
    readonly eventBus: EngineEventBus;
    readonly storage: Storage;
    readonly connectorRegistry: ConnectorRegistry;
    readonly imageRegistry: ImageGenerationRegistry;
    readonly toolResolver: ToolResolver;
    readonly pluginManager: PluginManager;
    readonly inferenceRouter: InferenceRouter;
    readonly authStore: AuthStore;
    readonly memory: Memory;
    private readonly delayedSignals: DelayedSignalsFacade | null;
    private _crons: Crons | null = null;
    private _heartbeats: Heartbeats | null = null;
    private _signals: Signals | null = null;
    private entries = new Map<string, AgentEntry>();
    private keyMap = new Map<string, string>();
    private stage: "idle" | "loaded" | "running" = "idle";

    constructor(options: AgentSystemOptions) {
        this.config = options.config;
        this.eventBus = options.eventBus;
        this.storage = options.storage ?? storageResolve(this.config.current);
        this.connectorRegistry = options.connectorRegistry;
        this.imageRegistry = options.imageRegistry;
        this.toolResolver = options.toolResolver;
        this.pluginManager = options.pluginManager;
        this.inferenceRouter = options.inferenceRouter;
        this.authStore = options.authStore;
        this.memory = options.memory ?? new Memory({ usersDir: this.config.current.usersDir });
        this.delayedSignals = options.delayedSignals ?? null;
        this.eventBus.onEvent((event) => {
            if (event.type !== "signal.generated") {
                return;
            }
            const signal = event.payload as Signal;
            const agentId = parsePoisonPillAgentId(signal.type);
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

    get heartbeats(): Heartbeats {
        if (!this._heartbeats) {
            throw new Error("Heartbeats not set");
        }
        return this._heartbeats;
    }

    setHeartbeats(heartbeats: Heartbeats): void {
        this._heartbeats = heartbeats;
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
            const descriptor = record.descriptor;
            if (state.state === "dead") {
                await this.cancelPoisonPill(agentId, { descriptor });
                logger.info({ agentId }, "restore: Agent restore skipped (dead)");
                continue;
            }
            if (state.state === "sleeping") {
                if (descriptor.type === "subagent") {
                    await this.schedulePoisonPill(agentId, {
                        descriptor,
                        deliverAt: state.updatedAt + AGENT_POISON_PILL_DELAY_MS
                    });
                }
                const key = agentCacheKeyForCtx(ctx, descriptor);
                this.keyMap.set(key, agentId);
                logger.info({ agentId }, "restore: Agent restore skipped (sleeping)");
                continue;
            }
            const inbox = new AgentInbox(agentId);
            const userHome = this.userHomeForUserId(record.userId);
            const agent = Agent.restore(ctx, descriptor, state, inbox, this, userHome);
            const registered = this.registerEntry({
                ctx,
                descriptor,
                agent,
                inbox
            });
            registered.inbox.post({ type: "restore" });
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

    async post(ctx: Context, target: AgentPostTarget, item: AgentInboxItem): Promise<void> {
        if (this.stage === "idle" && (item.type === "message" || item.type === "system_message")) {
            const agentType = "descriptor" in target ? target.descriptor.type : "agent";
            logger.warn({ agentType }, "load: AgentSystem received message before load");
        }
        const targetLabel = "descriptor" in target ? `descriptor:${target.descriptor.type}` : `agent:${target.agentId}`;
        logger.debug(`receive: post() received itemType=${item.type} target=${targetLabel} stage=${this.stage}`);
        const entry = await this.resolveEntry(ctx, target, item);
        await this.enqueueEntry(entry, item, null);
        logger.debug(`event: post() queued item agentId=${entry.ctx.agentId} inboxSize=${entry.inbox.size()}`);
        this.startEntryIfRunning(entry);
    }

    async postAndAwait(ctx: Context, target: AgentPostTarget, item: AgentInboxItem): Promise<AgentInboxResult> {
        const entry = await this.resolveEntry(ctx, target, item);
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
        const frontendAgents = records.filter((record) => record.descriptor.type === "user");
        await Promise.all(
            frontendAgents.map(async (record) => {
                const targetCtx = contextForAgent({ userId: targetUserId, agentId: record.id });
                await this.post(targetCtx, { agentId: record.id }, item);
            })
        );
    }

    /**
     * Resolves a target to its concrete agent id, creating/restoring when needed.
     * Expects: descriptor targets are valid for agent creation.
     */
    async agentIdForTarget(ctx: Context, target: AgentPostTarget): Promise<string> {
        const entry = await this.resolveEntry(ctx, target, {
            type: "message",
            message: { text: null },
            context: {}
        });
        return entry.ctx.agentId;
    }

    async tokensForTarget(ctx: Context, target: AgentPostTarget): Promise<AgentTokenEntry | null> {
        const entry = await this.resolveEntry(ctx, target, {
            type: "message",
            message: { text: null },
            context: {}
        });
        const tokens = entry.agent.state.tokens;
        if (!tokens) {
            return null;
        }
        return {
            provider: tokens.provider,
            model: tokens.model,
            size: { ...tokens.size }
        };
    }

    async agentExists(agentId: string): Promise<boolean> {
        if (this.entries.has(agentId)) {
            return true;
        }
        try {
            const context = await this.contextForAgentId(agentId);
            if (!context) {
                return false;
            }
            const descriptor = await agentDescriptorRead(this.storage, context);
            return !!descriptor;
        } catch {
            return false;
        }
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
            if (entry.descriptor.type !== "memory-agent" && entry.descriptor.type !== "memory-search") {
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
            await this.schedulePoisonPill(agentId, { descriptor: entry.descriptor });
            slept = true;
        });
        if (slept) {
            await this.signalLifecycle(agentId, "sleep");
        }
    }

    agentFor(ctx: Context, strategy: AgentFetchStrategy): string | null {
        const candidates = Array.from(this.entries.values()).filter((entry) => {
            return entry.ctx.userId === ctx.userId && agentDescriptorMatchesStrategy(entry.descriptor, strategy);
        });
        if (candidates.length === 0) {
            return null;
        }
        candidates.sort((a, b) => {
            const aTime = agentTimestampGet(a.agent.state.updatedAt);
            const bTime = agentTimestampGet(b.agent.state.updatedAt);
            return bTime - aTime;
        });
        return candidates[0]?.ctx.agentId ?? null;
    }

    /**
     * Returns the descriptor for an agent by id.
     * Returns null if the agent is not found.
     */
    getAgentDescriptor(agentId: string): AgentDescriptor | null {
        const entry = this.entries.get(agentId);
        return entry?.descriptor ?? null;
    }

    /**
     * Updates a loaded agent descriptor in memory without changing its identity.
     * Expects: descriptor type does not require keyMap changes (e.g. permanent agents).
     */
    updateAgentDescriptor(agentId: string, descriptor: AgentDescriptor): void {
        const entry = this.entries.get(agentId);
        if (!entry) {
            return;
        }
        Object.assign(entry.descriptor, descriptor);
        Object.assign(entry.agent.descriptor, descriptor);
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
        entry.agent.state.permissions = permissions;
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
        const descriptorKey = agentDescriptorCacheKey(target.descriptor);
        for (const entry of this.entries.values()) {
            if (agentDescriptorCacheKey(entry.descriptor) === descriptorKey) {
                return entry;
            }
        }
        return null;
    }

    private async resolveEntry(ctx: Context, target: AgentPostTarget, _item: AgentInboxItem): Promise<AgentEntry> {
        if ("agentId" in target) {
            const existing = this.entries.get(target.agentId);
            if (existing) {
                if (existing.agent.state.state === "dead" || existing.terminating) {
                    throw deadErrorBuild(target.agentId);
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

        const descriptor = target.descriptor;
        const key = agentCacheKeyForCtx(ctx, descriptor);
        const existingAgentId = this.keyMap.get(key);
        if (existingAgentId) {
            const existing = this.entries.get(existingAgentId);
            if (existing) {
                if (existing.agent.state.state === "dead" || existing.terminating) {
                    throw deadErrorBuild(existingAgentId);
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

        if (descriptor.type === "cron" && cuid2Is(descriptor.id)) {
            const existing = this.entries.get(descriptor.id);
            if (existing) {
                if (existing.agent.state.state === "dead" || existing.terminating) {
                    throw deadErrorBuild(descriptor.id);
                }
                if (existing.ctx.userId !== ctx.userId) {
                    throw new Error(`Cannot resolve agent from another user: ${descriptor.id}`);
                }
                return existing;
            }
            const restored = await this.restoreAgent(descriptor.id, { allowSleeping: true });
            if (restored) {
                if (restored.ctx.userId !== ctx.userId) {
                    throw new Error(`Cannot resolve agent from another user: ${descriptor.id}`);
                }
                return restored;
            }
        }

        const agentId = descriptor.type === "cron" && cuid2Is(descriptor.id) ? descriptor.id : createId();
        const resolvedDescriptor =
            (descriptor.type === "subagent" || descriptor.type === "app") && descriptor.id !== agentId
                ? { ...descriptor, id: agentId }
                : descriptor;
        logger.debug(`event: Creating agent entry agentId=${agentId} type=${resolvedDescriptor.type}`);
        const inbox = new AgentInbox(agentId);
        const userId = await this.resolveUserIdForDescriptor(ctx, resolvedDescriptor);
        if (userId !== ctx.userId) {
            throw new Error(`Cannot create agent for another user: ${agentId}`);
        }
        const createdCtx = contextForAgent({ userId, agentId });
        const userHome = this.userHomeForCtx(createdCtx);
        const agent = await Agent.create(createdCtx, resolvedDescriptor, inbox, this, userHome);
        const entry = this.registerEntry({
            ctx: createdCtx,
            descriptor: resolvedDescriptor,
            agent,
            inbox
        });
        logger.debug(`register: Agent entry registered agentId=${agentId}`);
        return entry;
    }

    private registerEntry(input: {
        ctx: Context;
        descriptor: AgentDescriptor;
        agent: Agent;
        inbox: AgentInbox;
    }): AgentEntry {
        const entry: AgentEntry = {
            ctx: input.ctx,
            descriptor: input.descriptor,
            agent: input.agent,
            inbox: input.inbox,
            running: false,
            terminating: false,
            lock: new AsyncLock()
        };
        this.entries.set(input.ctx.agentId, entry);
        const key = agentCacheKeyForCtx(input.ctx, input.descriptor);
        this.keyMap.set(key, input.ctx.agentId);
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
        logger.debug(`start: startEntryIfRunning starting agentId=${entry.ctx.agentId} type=${entry.descriptor.type}`);
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
            const rows = await this.storage.inbox.findByAgentId(entry.ctx.agentId);
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
        await this.cancelPoisonPill(entry.ctx.agentId, { descriptor: entry.descriptor });
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
        const type = lifecycleSignalTypeBuild(agentId, "idle");
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
                type: lifecycleSignalTypeBuild(agentId, "idle"),
                repeatKey: AGENT_IDLE_REPEAT_KEY
            });
        } catch (error) {
            logger.warn({ agentId, error }, "error: Failed to cancel idle lifecycle signal");
        }
    }

    private async schedulePoisonPill(
        agentId: string,
        options?: { descriptor?: AgentDescriptor; deliverAt?: number }
    ): Promise<void> {
        if (!this.delayedSignals) {
            return;
        }
        const descriptor = options?.descriptor ?? this.entries.get(agentId)?.descriptor;
        if (descriptor?.type !== "subagent" && descriptor?.type !== "memory-search") {
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
                type: lifecycleSignalTypeBuild(agentId, "poison-pill"),
                deliverAt: options?.deliverAt ?? Date.now() + AGENT_POISON_PILL_DELAY_MS,
                source: { type: "agent", id: agentId, userId: context.userId },
                data: { agentId, state: "poison-pill" },
                repeatKey: AGENT_POISON_PILL_REPEAT_KEY
            });
        } catch (error) {
            logger.warn({ agentId, error }, "error: Failed to schedule poison-pill signal");
        }
    }

    private async cancelPoisonPill(agentId: string, options?: { descriptor?: AgentDescriptor }): Promise<void> {
        if (!this.delayedSignals) {
            return;
        }
        const descriptor = options?.descriptor ?? this.entries.get(agentId)?.descriptor;
        if (descriptor?.type !== "subagent" && descriptor?.type !== "memory-search") {
            return;
        }
        try {
            await this.delayedSignals.cancelByRepeatKey({
                type: lifecycleSignalTypeBuild(agentId, "poison-pill"),
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
                type: lifecycleSignalTypeBuild(agentId, state),
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
            if (entry.descriptor.type !== "subagent") {
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

        let descriptor: AgentDescriptor | null = null;
        let state: Awaited<ReturnType<typeof agentStateRead>> = null;
        try {
            const context = await this.contextForAgentId(agentId);
            if (!context) {
                return;
            }
            descriptor = await agentDescriptorRead(this.storage, context);
            state = await agentStateRead(this.storage, context);
        } catch (error) {
            logger.warn({ agentId, error }, "error: Poison-pill read failed");
            return;
        }
        if (!descriptor || !state || descriptor.type !== "subagent") {
            return;
        }
        if (state.state === "dead") {
            return;
        }
        await this.cancelPoisonPill(agentId, { descriptor });
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
            await this.cancelPoisonPill(entry.ctx.agentId, { descriptor: entry.descriptor });
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
        const key = agentCacheKeyForCtx(entry.ctx, entry.descriptor);
        this.keyMap.delete(key);
        const deadError = deadErrorBuild(entry.ctx.agentId);
        for (const queued of pending) {
            queued.completion?.reject(deadError);
        }
        this.eventBus.emit("agent.dead", { agentId: entry.ctx.agentId, reason });
    }

    private async restoreAgent(agentId: string, options?: { allowSleeping?: boolean }): Promise<AgentEntry | null> {
        let descriptor: AgentDescriptor | null = null;
        let state: Awaited<ReturnType<typeof agentStateRead>> = null;
        let ctx: Context | null = null;
        try {
            ctx = await this.contextForAgentId(agentId);
            if (!ctx) {
                return null;
            }
            descriptor = await agentDescriptorRead(this.storage, ctx);
            state = await agentStateRead(this.storage, ctx);
        } catch (error) {
            logger.warn({ agentId, error }, "error: Agent restore failed due to invalid persisted data");
            return null;
        }
        if (!descriptor || !state || !ctx) {
            return null;
        }
        if (state.state === "dead") {
            throw deadErrorBuild(agentId);
        }
        if (state.state === "sleeping" && !options?.allowSleeping) {
            return null;
        }
        const inbox = new AgentInbox(agentId);
        const userHome = this.userHomeForCtx(ctx);
        const agent = Agent.restore(ctx, descriptor, state, inbox, this, userHome);
        const entry = this.registerEntry({
            ctx,
            descriptor,
            agent,
            inbox
        });
        entry.inbox.post({ type: "restore" });
        await this.replayPersistedInboxItems(entry);
        this.startEntryIfRunning(entry);
        return entry;
    }

    private async resolveUserIdForDescriptor(ctx: Context, descriptor: AgentDescriptor): Promise<string> {
        if (descriptor.type === "user") {
            const connectorKey = userConnectorKeyCreate(descriptor.connector, descriptor.userId);
            return this.resolveUserIdForConnectorKey(connectorKey);
        }
        if (descriptor.type === "subagent" || descriptor.type === "app" || descriptor.type === "memory-search") {
            const parent = await this.contextForAgentId(descriptor.parentAgentId);
            if (parent) {
                return parent.userId;
            }
            throw new Error("Parent agent not found");
        }
        if (descriptor.type === "memory-agent") {
            const source = await this.contextForAgentId(descriptor.id);
            if (source) {
                return source.userId;
            }
            throw new Error("Source agent not found for memory-agent");
        }
        // Subuser gateway agents belong to the subuser — descriptor.id IS the subuser's userId
        if (descriptor.type === "subuser") {
            return descriptor.id;
        }
        if (descriptor.type === "system" || descriptor.type === "cron" || descriptor.type === "permanent") {
            return ctx.userId;
        }
        throw new Error("Cannot resolve user for descriptor");
    }

    private async resolveUserIdForConnectorKey(connectorKey: string): Promise<string> {
        try {
            const user = await this.storage.resolveUserByConnectorKey(connectorKey);
            const userId = user.id?.trim() ?? "";
            if (userId) {
                return userId;
            }
        } catch (error) {
            logger.warn({ connectorKey, error }, "warn: Failed to resolve connector user");
        }
        throw new Error("User not found for connector key");
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

function lifecycleSignalTypeBuild(agentId: string, state: "wake" | "sleep" | "idle" | "poison-pill"): string {
    return `agent:${agentId}:${state}`;
}

function agentCacheKeyForCtx(ctx: Context, descriptor: AgentDescriptor): string {
    return `${ctx.userId}:${agentDescriptorCacheKey(descriptor)}`;
}

function parsePoisonPillAgentId(signalType: string): string | null {
    const parts = signalType.split(":");
    if (parts.length !== 3) {
        return null;
    }
    const [prefix, agentId, suffix] = parts;
    if (prefix !== "agent" || suffix !== "poison-pill") {
        return null;
    }
    const normalized = agentId?.trim() ?? "";
    return normalized ? normalized : null;
}

function deadErrorBuild(agentId: string): Error {
    return new Error(`Agent is dead: ${agentId}`);
}
