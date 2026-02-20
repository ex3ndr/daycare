import { promises as fs } from "node:fs";

import { createId } from "@paralleldrive/cuid2";
import type {
    AgentTokenEntry,
    DelayedSignalCancelRepeatKeyInput,
    DelayedSignalScheduleInput,
    PermissionAccess,
    PermissionDecision,
    SessionPermissions,
    Signal,
    SignalSubscription
} from "@/types";
import type { AuthStore } from "../../auth/store.js";
import type { FileStore } from "../../files/store.js";
import { getLogger } from "../../log.js";
import type { Storage } from "../../storage/storage.js";
import { storageResolve } from "../../storage/storageResolve.js";
import { userConnectorKeyCreate } from "../../storage/userConnectorKeyCreate.js";
import { AsyncLock } from "../../util/lock.js";
import { cuid2Is } from "../../utils/cuid2Is.js";
import { appPermissionStateGrant } from "../apps/appPermissionStateGrant.js";
import type { ConfigModule } from "../config/configModule.js";
import type { Crons } from "../cron/crons.js";
import type { Heartbeats } from "../heartbeat/heartbeats.js";
import type { EngineEventBus } from "../ipc/events.js";
import type { ConnectorRegistry } from "../modules/connectorRegistry.js";
import type { ImageGenerationRegistry } from "../modules/imageGenerationRegistry.js";
import type { InferenceRouter } from "../modules/inference/router.js";
import type { ToolResolver } from "../modules/toolResolver.js";
import { PermissionRequestRegistry } from "../modules/tools/permissionRequestRegistry.js";
import { permissionAccessApply } from "../permissions/permissionAccessApply.js";
import { permissionClone } from "../permissions/permissionClone.js";
import { permissionFormatTag } from "../permissions/permissionFormatTag.js";
import type { PluginManager } from "../plugins/manager.js";
import type { Signals } from "../signals/signals.js";
import { UserHome } from "../users/userHome.js";
import { Agent } from "./agent.js";
import { AgentContext } from "./agentContext.js";
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
    agentId: string;
    userId: string;
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
    fileStore: FileStore;
    authStore: AuthStore;
    delayedSignals?: DelayedSignalsFacade;
    permissionRequestRegistry?: PermissionRequestRegistry;
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
    readonly fileStore: FileStore;
    readonly authStore: AuthStore;
    readonly permissionRequestRegistry: PermissionRequestRegistry;
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
        this.fileStore = options.fileStore;
        this.authStore = options.authStore;
        this.delayedSignals = options.delayedSignals ?? null;
        this.permissionRequestRegistry = options.permissionRequestRegistry ?? new PermissionRequestRegistry();
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
            let state: Awaited<ReturnType<typeof agentStateRead>> = null;
            try {
                state = await agentStateRead(this.storage, agentId);
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
                const key = agentDescriptorCacheKey(descriptor);
                this.keyMap.set(key, agentId);
                logger.info({ agentId }, "restore: Agent restore skipped (sleeping)");
                continue;
            }
            const inbox = new AgentInbox(agentId);
            const userHome = this.userHomeForUserId(record.userId);
            const agent = Agent.restore(agentId, record.userId, descriptor, state, inbox, this, userHome);
            const registered = this.registerEntry({
                agentId,
                userId: record.userId,
                descriptor,
                agent,
                inbox
            });
            registered.inbox.post({ type: "restore" });
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

    async post(target: AgentPostTarget, item: AgentInboxItem): Promise<void> {
        if (this.stage === "idle" && (item.type === "message" || item.type === "system_message")) {
            const agentType = "descriptor" in target ? target.descriptor.type : "agent";
            logger.warn({ agentType }, "load: AgentSystem received message before load");
        }
        const targetLabel = "descriptor" in target ? `descriptor:${target.descriptor.type}` : `agent:${target.agentId}`;
        logger.debug(`receive: post() received itemType=${item.type} target=${targetLabel} stage=${this.stage}`);
        const entry = await this.resolveEntry(target, item);
        await this.enqueueEntry(entry, item, null);
        logger.debug(`event: post() queued item agentId=${entry.agentId} inboxSize=${entry.inbox.size()}`);
        this.startEntryIfRunning(entry);
    }

    async postAndAwait(target: AgentPostTarget, item: AgentInboxItem): Promise<AgentInboxResult> {
        const entry = await this.resolveEntry(target, item);
        const completion = this.createCompletion();
        await this.enqueueEntry(entry, item, completion.completion);
        this.startEntryIfRunning(entry);
        return completion.promise;
    }

    async permissionsForTarget(target: AgentPostTarget): Promise<SessionPermissions> {
        const entry = await this.resolveEntry(target, {
            type: "message",
            message: { text: null },
            context: {}
        });
        return permissionClone(entry.agent.state.permissions);
    }

    /**
     * Resolves a target to its concrete agent id, creating/restoring when needed.
     * Expects: descriptor targets are valid for agent creation.
     */
    async agentIdForTarget(target: AgentPostTarget): Promise<string> {
        const entry = await this.resolveEntry(target, {
            type: "message",
            message: { text: null },
            context: {}
        });
        return entry.agentId;
    }

    async tokensForTarget(target: AgentPostTarget): Promise<AgentTokenEntry | null> {
        const entry = await this.resolveEntry(target, {
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
            const descriptor = await agentDescriptorRead(this.storage, agentId);
            return !!descriptor;
        } catch {
            return false;
        }
    }

    /**
     * Reads agent + user identity by agent id.
     * Returns: null when the agent does not exist in memory or storage.
     */
    async agentContextForAgentId(agentId: string): Promise<AgentContext | null> {
        const loaded = this.entries.get(agentId);
        if (loaded) {
            return new AgentContext(loaded.agentId, loaded.userId);
        }
        const record = await this.storage.agents.findById(agentId);
        if (!record) {
            return null;
        }
        return new AgentContext(record.id, record.userId);
    }

    async signalDeliver(signal: Signal, subscriptions: SignalSubscription[]): Promise<void> {
        await Promise.all(
            subscriptions.map(async (subscription) => {
                if (signal.source.type === "agent" && signal.source.id === subscription.agentId) {
                    return;
                }
                const context = await this.agentContextForAgentId(subscription.agentId);
                if (!context || context.userId !== subscription.userId) {
                    return;
                }
                try {
                    await this.post(
                        { agentId: subscription.agentId },
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
                            agentId: subscription.agentId,
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
    async steer(agentId: string, steering: AgentInboxSteering): Promise<void> {
        const entry = this.entries.get(agentId);
        if (!entry) {
            throw new Error(`Agent not found: ${agentId}`);
        }
        let woke = false;
        await entry.lock.inLock(async () => {
            woke = await this.wakeEntryIfSleeping(entry);
            entry.inbox.steer(steering);
        });
        if (woke) {
            await this.signalLifecycle(entry.agentId, "wake");
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
        logger.info({ agentId: entry.agentId, aborted }, "event: Abort inference requested");
        return aborted;
    }

    async grantPermission(
        target: AgentPostTarget,
        access: PermissionAccess,
        options?: { source?: string; decision?: PermissionDecision }
    ): Promise<void> {
        const entry = await this.resolveEntry(target, {
            type: "message",
            message: { text: null },
            context: {}
        });
        const applied = permissionAccessApply(entry.agent.state.permissions, access);
        if (!applied) {
            throw new Error("Permission could not be applied.");
        }
        await agentStateWrite(this.storage, entry.agentId, entry.agent.state);
        const decision: PermissionDecision = options?.decision ?? {
            token: "direct",
            agentId: entry.agentId,
            approved: true,
            permissions: [{ permission: permissionFormatTag(access), access }]
        };
        this.eventBus.emit("permission.granted", {
            agentId: entry.agentId,
            source: options?.source ?? "agent",
            decision
        });
    }

    /**
     * Grants a shared permission to an app and syncs loaded app-agent sessions.
     * Expects: appId belongs to an installed app.
     */
    async grantAppPermission(
        appId: string,
        access: PermissionAccess,
        options?: { source?: string; decision?: PermissionDecision }
    ): Promise<void> {
        const userIds = new Set<string>();
        for (const entry of this.entries.values()) {
            if (entry.descriptor.type !== "app" || entry.descriptor.appId !== appId) {
                continue;
            }
            userIds.add(entry.userId);
        }
        if (userIds.size === 0) {
            userIds.add(await this.ownerUserIdEnsure());
        }
        for (const userId of userIds) {
            const userHome = this.userHomeForUserId(userId);
            await appPermissionStateGrant(userHome.apps, appId, access);
        }
        for (const entry of this.entries.values()) {
            if (entry.descriptor.type !== "app" || entry.descriptor.appId !== appId) {
                continue;
            }
            const applied = permissionAccessApply(entry.agent.state.permissions, access);
            if (!applied) {
                throw new Error("Permission could not be applied.");
            }
            entry.agent.state.updatedAt = Date.now();
            await agentStateWrite(this.storage, entry.agentId, entry.agent.state);
            const decision: PermissionDecision = options?.decision
                ? {
                      ...options.decision,
                      agentId: entry.agentId,
                      scope: "always"
                  }
                : {
                      token: "direct",
                      agentId: entry.agentId,
                      approved: true,
                      permissions: [{ permission: permissionFormatTag(access), access }],
                      scope: "always"
                  };
            this.eventBus.emit("permission.granted", {
                agentId: entry.agentId,
                source: options?.source ?? "agent",
                decision
            });
        }
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
            await agentStateWrite(this.storage, agentId, entry.agent.state);
            this.eventBus.emit("agent.sleep", { agentId, reason });
            logger.debug({ agentId, reason }, "event: Agent entered sleep mode");
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

    agentFor(strategy: AgentFetchStrategy): string | null {
        const candidates = Array.from(this.entries.values()).filter((entry) => {
            return agentDescriptorMatchesStrategy(entry.descriptor, strategy);
        });
        if (candidates.length === 0) {
            return null;
        }
        candidates.sort((a, b) => {
            const aTime = agentTimestampGet(a.agent.state.updatedAt);
            const bTime = agentTimestampGet(b.agent.state.updatedAt);
            return bTime - aTime;
        });
        return candidates[0]?.agentId ?? null;
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

    async inReadLock<T>(operation: () => Promise<T>): Promise<T> {
        return this.config.inReadLock(operation);
    }

    private findLoadedEntry(target: AgentPostTarget): AgentEntry | null {
        if ("agentId" in target) {
            return this.entries.get(target.agentId) ?? null;
        }
        const key = agentDescriptorCacheKey(target.descriptor);
        const agentId = this.keyMap.get(key);
        if (!agentId) {
            return null;
        }
        return this.entries.get(agentId) ?? null;
    }

    private async resolveEntry(target: AgentPostTarget, _item: AgentInboxItem): Promise<AgentEntry> {
        if ("agentId" in target) {
            const existing = this.entries.get(target.agentId);
            if (existing) {
                if (existing.agent.state.state === "dead" || existing.terminating) {
                    throw deadErrorBuild(target.agentId);
                }
                return existing;
            }
            const restored = await this.restoreAgent(target.agentId, { allowSleeping: true });
            if (restored) {
                return restored;
            }
            throw new Error(`Agent not found: ${target.agentId}`);
        }

        const descriptor = target.descriptor;
        const key = agentDescriptorCacheKey(descriptor);
        const existingAgentId = this.keyMap.get(key);
        if (existingAgentId) {
            const existing = this.entries.get(existingAgentId);
            if (existing) {
                if (existing.agent.state.state === "dead" || existing.terminating) {
                    throw deadErrorBuild(existingAgentId);
                }
                return existing;
            }
            const restored = await this.restoreAgent(existingAgentId, { allowSleeping: true });
            if (restored) {
                return restored;
            }
        }

        if (descriptor.type === "cron" && cuid2Is(descriptor.id)) {
            const existing = this.entries.get(descriptor.id);
            if (existing) {
                if (existing.agent.state.state === "dead" || existing.terminating) {
                    throw deadErrorBuild(descriptor.id);
                }
                return existing;
            }
            const restored = await this.restoreAgent(descriptor.id, { allowSleeping: true });
            if (restored) {
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
        const userId = await this.resolveUserIdForDescriptor(resolvedDescriptor);
        const userHome = this.userHomeForUserId(userId);
        const agent = await Agent.create(agentId, resolvedDescriptor, userId, inbox, this, userHome);
        const entry = this.registerEntry({
            agentId,
            userId,
            descriptor: resolvedDescriptor,
            agent,
            inbox
        });
        logger.debug(`register: Agent entry registered agentId=${agentId}`);
        return entry;
    }

    private registerEntry(input: {
        agentId: string;
        userId: string;
        descriptor: AgentDescriptor;
        agent: Agent;
        inbox: AgentInbox;
    }): AgentEntry {
        const entry: AgentEntry = {
            agentId: input.agentId,
            userId: input.userId,
            descriptor: input.descriptor,
            agent: input.agent,
            inbox: input.inbox,
            running: false,
            terminating: false,
            lock: new AsyncLock()
        };
        this.entries.set(input.agentId, entry);
        const key = agentDescriptorCacheKey(input.descriptor);
        this.keyMap.set(key, input.agentId);
        return entry;
    }

    private startEntryIfRunning(entry: AgentEntry): void {
        if (this.stage !== "running") {
            logger.debug(`skip: startEntryIfRunning skipped agentId=${entry.agentId} reason=stage:${this.stage}`);
            return;
        }
        if (entry.running) {
            logger.debug(`skip: startEntryIfRunning skipped agentId=${entry.agentId} reason=already-running`);
            return;
        }
        logger.debug(`start: startEntryIfRunning starting agentId=${entry.agentId} type=${entry.descriptor.type}`);
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
            entry.inbox.post(item, completion);
        });
        if (woke) {
            await this.signalLifecycle(entry.agentId, "wake");
        }
    }

    private async wakeEntryIfSleeping(entry: AgentEntry): Promise<boolean> {
        if (entry.agent.state.state !== "sleeping") {
            return false;
        }
        await this.cancelIdleSignal(entry.agentId);
        await this.cancelPoisonPill(entry.agentId, { descriptor: entry.descriptor });
        entry.agent.state.state = "active";
        await agentStateWrite(this.storage, entry.agentId, entry.agent.state);
        this.eventBus.emit("agent.woke", { agentId: entry.agentId });
        logger.debug({ agentId: entry.agentId }, "event: Agent woke from sleep");
        return true;
    }

    private async scheduleIdleSignal(agentId: string): Promise<void> {
        if (!this.delayedSignals) {
            return;
        }
        const context = await this.agentContextForAgentId(agentId);
        const deliverAt = Date.now() + AGENT_IDLE_DELAY_MS;
        const type = lifecycleSignalTypeBuild(agentId, "idle");
        try {
            await this.delayedSignals.schedule({
                type,
                deliverAt,
                source: { type: "agent", id: agentId, userId: context?.userId },
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
        if (descriptor?.type !== "subagent") {
            return;
        }
        const context = await this.agentContextForAgentId(agentId);
        try {
            // load() runs before DelayedSignals.start(); ensure persistence directory exists.
            await fs.mkdir(`${this.config.current.configDir}/signals`, { recursive: true });
            await this.delayedSignals.schedule({
                type: lifecycleSignalTypeBuild(agentId, "poison-pill"),
                deliverAt: options?.deliverAt ?? Date.now() + AGENT_POISON_PILL_DELAY_MS,
                source: { type: "agent", id: agentId, userId: context?.userId },
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
        if (descriptor?.type !== "subagent") {
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
        const context = await this.agentContextForAgentId(agentId);
        try {
            await this._signals.generate({
                type: lifecycleSignalTypeBuild(agentId, state),
                source: { type: "agent", id: agentId, userId: context?.userId },
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
            descriptor = await agentDescriptorRead(this.storage, agentId);
            state = await agentStateRead(this.storage, agentId);
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
        await agentStateWrite(this.storage, agentId, state);
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
            await this.cancelIdleSignal(entry.agentId);
            await this.cancelPoisonPill(entry.agentId, { descriptor: entry.descriptor });
            entry.agent.state.state = "dead";
            entry.agent.state.updatedAt = Date.now();
            await agentStateWrite(this.storage, entry.agentId, entry.agent.state);
            pending = entry.inbox.drainPending();
            changed = true;
        });
        if (!changed) {
            return;
        }
        entry.running = false;
        this.entries.delete(entry.agentId);
        const key = agentDescriptorCacheKey(entry.descriptor);
        this.keyMap.delete(key);
        const deadError = deadErrorBuild(entry.agentId);
        for (const queued of pending) {
            queued.completion?.reject(deadError);
        }
        this.eventBus.emit("agent.dead", { agentId: entry.agentId, reason });
    }

    private async restoreAgent(agentId: string, options?: { allowSleeping?: boolean }): Promise<AgentEntry | null> {
        let descriptor: AgentDescriptor | null = null;
        let state: Awaited<ReturnType<typeof agentStateRead>> = null;
        let recordUserId = "";
        try {
            descriptor = await agentDescriptorRead(this.storage, agentId);
            state = await agentStateRead(this.storage, agentId);
            const record = await this.storage.agents.findById(agentId);
            recordUserId = record?.userId ?? "";
        } catch (error) {
            logger.warn({ agentId, error }, "error: Agent restore failed due to invalid persisted data");
            return null;
        }
        if (!descriptor || !state || !recordUserId) {
            return null;
        }
        if (state.state === "dead") {
            throw deadErrorBuild(agentId);
        }
        if (state.state === "sleeping" && !options?.allowSleeping) {
            return null;
        }
        const inbox = new AgentInbox(agentId);
        const userHome = this.userHomeForUserId(recordUserId);
        const agent = Agent.restore(agentId, recordUserId, descriptor, state, inbox, this, userHome);
        const entry = this.registerEntry({
            agentId,
            userId: recordUserId,
            descriptor,
            agent,
            inbox
        });
        entry.inbox.post({ type: "restore" });
        this.startEntryIfRunning(entry);
        return entry;
    }

    private async resolveUserIdForDescriptor(descriptor: AgentDescriptor): Promise<string> {
        if (descriptor.type === "user") {
            const connectorKey = userConnectorKeyCreate(descriptor.connector, descriptor.userId);
            return this.resolveUserIdForConnectorKey(connectorKey);
        }
        if (descriptor.type === "subagent" || descriptor.type === "app") {
            const parent = await this.agentContextForAgentId(descriptor.parentAgentId);
            if (parent) {
                return parent.userId;
            }
            return this.ownerUserIdEnsure();
        }
        return this.ownerUserIdEnsure();
    }

    private async resolveUserIdForConnectorKey(connectorKey: string): Promise<string> {
        const user = await this.storage.resolveUserByConnectorKey(connectorKey);
        return user.id;
    }

    private async ownerUserIdEnsure(): Promise<string> {
        const owner = await this.storage.users.findOwner();
        if (owner) {
            return owner.id;
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
            return ownerId;
        } catch {
            const recovered = await this.storage.users.findOwner();
            if (recovered) {
                return recovered.id;
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
