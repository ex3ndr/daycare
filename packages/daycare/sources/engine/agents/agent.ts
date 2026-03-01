import os from "node:os";
import path from "node:path";

import type { Context as InferenceContext } from "@mariozechner/pi-ai";
import { createId } from "@paralleldrive/cuid2";
import type { Context, MessageContext, ToolExecutionContext } from "@/types";
import { getLogger } from "../../log.js";
import { listActiveInferenceProviders } from "../../providers/catalog.js";
import { modelRoleApply } from "../../providers/modelRoleApply.js";
import { Sandbox } from "../../sandbox/sandbox.js";
import { tagExtractAll } from "../../util/tagExtract.js";
import { cuid2Is } from "../../utils/cuid2Is.js";
import { channelMessageBuild, channelSignalDataParse } from "../channels/channelMessageBuild.js";
import { messageBuildSystemSilentText } from "../messages/messageBuildSystemSilentText.js";
import { messageBuildSystemText } from "../messages/messageBuildSystemText.js";
import { messageBuildUser } from "../messages/messageBuildUser.js";
import { messageExtractText } from "../messages/messageExtractText.js";
import { messageFormatIncoming } from "../messages/messageFormatIncoming.js";
import { executablePromptExpand } from "../modules/executablePrompts/executablePromptExpand.js";
import { montyPreambleBuild } from "../modules/monty/montyPreambleBuild.js";
import { rlmExecute } from "../modules/rlm/rlmExecute.js";
import { rlmHistoryCompleteErrorRecordBuild } from "../modules/rlm/rlmHistoryCompleteErrorRecordBuild.js";
import { rlmToolsForContextResolve } from "../modules/rlm/rlmToolsForContextResolve.js";
import { permissionBuildUser } from "../permissions/permissionBuildUser.js";
import { signalMessageBuild } from "../signals/signalMessageBuild.js";
import { Skills } from "../skills/skills.js";
import type { UserHome } from "../users/userHome.js";
import { userHomeEnsure } from "../users/userHomeEnsure.js";
import type { AgentSystem } from "./agentSystem.js";
import { agentDescriptorRoleResolve } from "./ops/agentDescriptorRoleResolve.js";
import { agentDescriptorTargetResolve } from "./ops/agentDescriptorTargetResolve.js";
import type { AgentDescriptor } from "./ops/agentDescriptorTypes.js";
import { agentDescriptorWrite } from "./ops/agentDescriptorWrite.js";
import { agentHistoryAppend } from "./ops/agentHistoryAppend.js";
import { agentHistoryContext } from "./ops/agentHistoryContext.js";
import { agentHistoryLoad } from "./ops/agentHistoryLoad.js";
import type { AgentInbox } from "./ops/agentInbox.js";
import { agentLoopPendingPhaseResolve } from "./ops/agentLoopPendingPhaseResolve.js";
import { agentLoopRun } from "./ops/agentLoopRun.js";
import { agentModelOverrideApply } from "./ops/agentModelOverrideApply.js";
import { agentPromptFilesEnsure } from "./ops/agentPromptFilesEnsure.js";
import { agentPromptPathsResolve } from "./ops/agentPromptPathsResolve.js";
import { agentStateWrite } from "./ops/agentStateWrite.js";
import { type AgentSystemPromptContext, agentSystemPrompt } from "./ops/agentSystemPrompt.js";
import { agentSystemPromptWrite } from "./ops/agentSystemPromptWrite.js";
import { agentTokenPromptUsedFromUsage } from "./ops/agentTokenPromptUsedFromUsage.js";
import { agentToolExecutionAllowlistResolve } from "./ops/agentToolExecutionAllowlistResolve.js";
import type {
    AgentHistoryRecord,
    AgentInboxCompact,
    AgentInboxItem,
    AgentInboxMessage,
    AgentInboxReset,
    AgentInboxRestore,
    AgentInboxResult,
    AgentInboxSignal,
    AgentInboxSystemMessage,
    AgentMessage,
    AgentState
} from "./ops/agentTypes.js";
import { bundledExamplesDirResolve } from "./ops/bundledExamplesDirResolve.js";
import { contextCompact } from "./ops/contextCompact.js";
import { contextCompactionStatus } from "./ops/contextCompactionStatus.js";
import { contextEstimateTokens } from "./ops/contextEstimateTokens.js";
import { messageContextReset } from "./ops/messageContextReset.js";
import { systemPromptResolve } from "./ops/systemPromptResolve.js";

const logger = getLogger("engine.agent");
const RESTORE_FAILURE_RESET_MESSAGE = "Session restore failed - starting from scratch.";

export class Agent {
    readonly ctx: Context;
    readonly descriptor: AgentDescriptor;
    readonly inbox: AgentInbox;
    readonly state: AgentState;
    private readonly agentSystem: AgentSystem;
    private providerId: string | null = null;
    private processing = false;
    private started = false;
    private inferenceAbortController: AbortController | null = null;
    private readonly userHome: UserHome;
    readonly sandbox: Sandbox;
    private endTurnCount = 0;
    private readonly documentLastReadVersions = new Map<string, number>();

    private constructor(
        ctx: Context,
        descriptor: AgentDescriptor,
        state: AgentState,
        inbox: AgentInbox,
        agentSystem: AgentSystem,
        userHome: UserHome
    ) {
        if (!userHome) {
            throw new Error("Agent user home is required.");
        }
        this.ctx = ctx;
        this.descriptor = descriptor;
        this.state = state;
        this.inbox = inbox;
        this.agentSystem = agentSystem;
        this.userHome = userHome;
        const dockerSettings = this.agentSystem.config?.current?.settings?.docker;
        const examplesDir = bundledExamplesDirResolve();
        this.sandbox = new Sandbox({
            homeDir: this.userHome.home,
            permissions: this.state.permissions,
            mounts: [
                { hostPath: this.userHome.skillsActive, mappedPath: "/shared/skills" },
                ...(examplesDir ? [{ hostPath: examplesDir, mappedPath: "/shared/examples" }] : [])
            ],
            docker: dockerSettings?.enabled
                ? {
                      enabled: true,
                      image: dockerSettings.image,
                      tag: dockerSettings.tag,
                      socketPath: dockerSettings.socketPath,
                      runtime: dockerSettings.runtime,
                      enableWeakerNestedSandbox: dockerSettings.enableWeakerNestedSandbox,
                      readOnly: dockerSettings.readOnly,
                      unconfinedSecurity: dockerSettings.unconfinedSecurity,
                      capAdd: dockerSettings.capAdd,
                      capDrop: dockerSettings.capDrop,
                      allowLocalNetworkingForUsers: dockerSettings.allowLocalNetworkingForUsers,
                      isolatedDnsServers: dockerSettings.isolatedDnsServers,
                      localDnsServers: dockerSettings.localDnsServers,
                      userId: this.ctx.userId
                  }
                : undefined
        });
    }

    /**
     * Creates a new agent and persists descriptor + state + initial session row.
     * Expects: ctx.agentId is a cuid2 value; descriptor is validated.
     */
    static async create(
        ctx: Context,
        descriptor: AgentDescriptor,
        inbox: AgentInbox,
        agentSystem: AgentSystem,
        userHome: UserHome
    ): Promise<Agent> {
        if (!cuid2Is(ctx.agentId)) {
            throw new Error("Agent id must be a cuid2 value.");
        }
        await userHomeEnsure(userHome);
        const now = Date.now();
        const basePermissions = permissionBuildUser(userHome);
        const state: AgentState = {
            context: { messages: [] },
            activeSessionId: null,
            inferenceSessionId: createId(),
            permissions: basePermissions,
            tokens: null,
            stats: {},
            createdAt: now,
            updatedAt: now,
            state: "active"
        };

        const agent = new Agent(ctx, descriptor, state, inbox, agentSystem, userHome);
        await agentDescriptorWrite(agentSystem.storage, ctx, descriptor, basePermissions);
        await agentStateWrite(agentSystem.storage, ctx, state);
        state.activeSessionId = await agentSystem.storage.sessions.create({
            agentId: ctx.agentId,
            inferenceSessionId: state.inferenceSessionId,
            createdAt: now
        });
        await agentStateWrite(agentSystem.storage, ctx, state);

        agent.agentSystem.eventBus.emit("agent.created", {
            agentId: ctx.agentId,
            source: "agent",
            context: {}
        });
        return agent;
    }

    /**
     * Rehydrates an agent from persisted descriptor + state.
     * Rebuilds permissions from userHome to avoid stale legacy paths.
     * Expects: state and descriptor already validated.
     */
    static restore(
        ctx: Context,
        descriptor: AgentDescriptor,
        state: AgentState,
        inbox: AgentInbox,
        agentSystem: AgentSystem,
        userHome: UserHome
    ): Agent {
        const basePermissions = permissionBuildUser(userHome);
        const permissions =
            descriptor.type === "permanent" && descriptor.workspaceDir
                ? { ...basePermissions, workingDir: descriptor.workspaceDir }
                : basePermissions;
        const refreshedState: AgentState = { ...state, permissions };
        return new Agent(ctx, descriptor, refreshedState, inbox, agentSystem, userHome);
    }

    get id(): string {
        return this.ctx.agentId;
    }

    get userId(): string {
        return this.ctx.userId;
    }

    /**
     * Remembers the latest read version for each document in the active session.
     * Expects: entries are from a resolved root-to-target chain.
     */
    documentChainReadMark(entries: Array<{ id: string; version: number }>): void {
        for (const entry of entries) {
            const id = entry.id.trim();
            if (!id) {
                continue;
            }
            this.documentLastReadVersions.set(id, entry.version);
        }
    }

    /**
     * Returns the last read version for a document in this session.
     * Expects: documentId belongs to the same user scope as this agent.
     */
    documentVersionLastRead(documentId: string): number | null {
        const id = documentId.trim();
        if (!id) {
            return null;
        }
        return this.documentLastReadVersions.get(id) ?? null;
    }

    start(): void {
        if (this.started) {
            return;
        }
        this.started = true;
        logger.debug(`start: Agent loop starting agentId=${this.id} type=${this.descriptor.type}`);
        void this.runLoop().catch((error) => {
            this.started = false;
            this.agentSystem.markStopped(this.id, error);
            logger.warn({ agentId: this.id, error }, "event: Agent loop exited unexpectedly");
        });
    }

    isProcessing(): boolean {
        return this.processing;
    }

    /**
     * Aborts the currently running inference call for this agent.
     * Returns false when no active inference is in flight.
     */
    abortInference(): boolean {
        const controller = this.inferenceAbortController;
        if (!controller || controller.signal.aborted) {
            return false;
        }
        controller.abort();
        return true;
    }

    private async runLoop(): Promise<void> {
        this.inbox.attach();
        try {
            for (;;) {
                const entry = await this.inbox.next();
                logger.debug(`event: Agent inbox item dequeued agentId=${this.id} type=${entry.item.type}`);
                this.processing = true;
                try {
                    const result = await this.agentSystem.inReadLock(async () => this.handleInboxItem(entry.item));
                    await this.sleepAfterItem(entry.item);
                    entry.completion?.resolve(result);
                } catch (error) {
                    const failure = error instanceof Error ? error : new Error(String(error));
                    logger.error(
                        {
                            agentId: this.id,
                            itemType: entry.item.type,
                            errorName: failure.name,
                            errorMessage: failure.message,
                            errorStack: failure.stack
                        },
                        `error: Agent inbox item failed: ${failure.message}`
                    );
                    entry.completion?.reject(failure);
                    if (entry.item.type === "message") {
                        await this.sendUnexpectedError(entry.item);
                    }
                } finally {
                    try {
                        await this.agentSystem.deleteInboxItem(entry.id);
                    } catch (error) {
                        logger.warn(
                            { agentId: this.id, inboxItemId: entry.id, error },
                            "error: Failed to delete inbox item"
                        );
                    }
                    this.processing = false;
                }
            }
        } finally {
            this.inbox.detach();
        }
    }

    /**
     * Attempts to put the agent to sleep after processing a message or reset.
     * Expects: inbox item handled successfully.
     */
    private async sleepAfterItem(item: AgentInboxItem): Promise<void> {
        if (
            item.type !== "message" &&
            item.type !== "system_message" &&
            item.type !== "signal" &&
            item.type !== "reset" &&
            item.type !== "compact" &&
            item.type !== "restore"
        ) {
            return;
        }
        await this.agentSystem.sleepIfIdle(this.id, item.type);
    }

    /**
     * Increments end turn counter and invalidates the session when threshold exceeded.
     * Runtime-only — no persistence needed for the counter.
     */
    private async invalidateSessionIfNeeded(): Promise<void> {
        this.endTurnCount += 1;
        if (this.endTurnCount <= 5) {
            return;
        }
        // Memory-agents and memory-search agents must never trigger the memory worker
        if (this.descriptor.type === "memory-agent" || this.descriptor.type === "memory-search") {
            return;
        }
        const sessionId = this.state.activeSessionId;
        if (!sessionId) {
            return;
        }
        const maxHistoryId = await this.agentSystem.storage.history.maxId(sessionId);
        if (maxHistoryId !== null) {
            await this.agentSystem.storage.sessions.invalidate(sessionId, maxHistoryId);
            logger.debug(`event: Session invalidated after ${this.endTurnCount} end turns sessionId=${sessionId}`);
        }
    }

    private async handleInboxItem(
        item:
            | AgentInboxMessage
            | AgentInboxSystemMessage
            | AgentInboxSignal
            | AgentInboxReset
            | AgentInboxCompact
            | AgentInboxRestore
    ): Promise<AgentInboxResult> {
        switch (item.type) {
            case "message": {
                const responseText = await this.handleMessage(item);
                return { type: "message", responseText };
            }
            case "system_message": {
                const systemResult = await this.handleSystemMessage(item);
                return {
                    type: "system_message",
                    responseText: systemResult.responseText,
                    responseError: systemResult.responseError,
                    ...(systemResult.executionErrorText ? { executionErrorText: systemResult.executionErrorText } : {})
                };
            }
            case "signal": {
                const signalResult = await this.handleSignal(item);
                return { type: "signal", ...signalResult };
            }
            case "reset": {
                const ok = await this.handleReset(item);
                return { type: "reset", ok };
            }
            case "compact": {
                const ok = await this.handleCompaction(item);
                return { type: "compact", ok };
            }
            case "restore": {
                const ok = await this.handleRestore(item);
                return { type: "restore", ok };
            }
            default:
                return { type: "restore", ok: false };
        }
    }

    private async sendUnexpectedError(item: AgentInboxMessage): Promise<void> {
        if (this.descriptor.type !== "user") {
            return;
        }
        const connector = this.agentSystem.connectorRegistry.get(this.descriptor.connector);
        if (!connector?.capabilities.sendText) {
            return;
        }
        try {
            await connector.sendMessage(this.descriptor.channelId, {
                text: "Unexpected error",
                replyToMessageId: item.context.messageId
            });
        } catch (error) {
            const failure = error instanceof Error ? error : new Error(String(error));
            logger.warn({ agentId: this.id, error: failure }, "error: Failed to send unexpected error message");
        }
    }

    private async handleMessage(item: AgentInboxMessage): Promise<string | null> {
        const receivedAt = Date.now();
        const messageId = createId();
        const context = { ...item.context };
        const entry: AgentMessage = {
            id: messageId,
            message: messageFormatIncoming(item.message, context, new Date(receivedAt)),
            context,
            receivedAt
        };
        const source = this.sourceResolve();
        logger.debug(
            `start: handleMessage start agentId=${this.id} source=${source} textLength=${entry.message.text?.length ?? 0} fileCount=${entry.message.files?.length ?? 0}`
        );

        this.state.updatedAt = receivedAt;

        const rawText = entry.message.rawText ?? entry.message.text ?? "";
        const files = toFileReferences(entry.message.files ?? []);
        entry.message.files = files;
        let compactionAt: number | null = null;
        let pendingUserRecord: AgentHistoryRecord | null = {
            type: "user_message",
            at: receivedAt,
            text: rawText,
            files,
            ...(context.enrichments ? { enrichments: context.enrichments.map((item) => ({ ...item })) } : {})
        };

        const { providers, providerId } = this.inferenceProvidersResolve();
        const connector = this.agentSystem.connectorRegistry.get(source);
        const skills = this.skillsResolve();
        const agentKind = this.resolveAgentKind();
        const pluginManager = this.agentSystem.pluginManager;

        const toolResolver = this.agentSystem.toolResolver;
        const providerSettings = providerId
            ? (providers.find((provider) => provider.id === providerId) ?? providers[0])
            : providers[0];

        const history = await agentHistoryLoad(this.agentSystem.storage, this.ctx);
        const isFirstMessage = history.length === 0;

        // Resolve configured system prompts (global, per-user, conditional)
        const resolvedPrompts = await systemPromptResolve(this.agentSystem.storage, this.ctx.userId, isFirstMessage);

        // First-message prompts are user-facing guidance and should not alter
        // internal/background agent inputs (memory-agent, cron, subagent, app, etc.).
        const shouldPrependFirstMessagePrompt = this.descriptor.type === "user" || this.descriptor.type === "subuser";
        if (shouldPrependFirstMessagePrompt && resolvedPrompts.firstMessagePrompt && entry.message.text !== null) {
            entry.message.text = `${resolvedPrompts.firstMessagePrompt}\n\n${entry.message.text}`;
            pendingUserRecord = {
                ...pendingUserRecord!,
                text: entry.message.rawText ?? entry.message.text,
                firstMessagePrepended: true,
                firstMessagePrompt: resolvedPrompts.firstMessagePrompt
            } as AgentHistoryRecord & { type: "user_message" };
        }

        await agentPromptFilesEnsure(agentPromptPathsResolve(this.userHome));
        logger.debug(`event: handleMessage building system prompt agentId=${this.id}`);
        const pluginPrompts =
            typeof pluginManager.getSystemPrompts === "function"
                ? await pluginManager.getSystemPrompts({
                      ctx: this.ctx,
                      descriptor: this.descriptor,
                      userDownloadsDir: this.userHome.downloads
                  })
                : [];
        const systemPromptContext: AgentSystemPromptContext = {
            provider: providerSettings?.id,
            model: providerSettings?.model,
            permissions: this.state.permissions,
            descriptor: this.descriptor,
            ctx: this.ctx,
            agentSystem: this.agentSystem,
            userHome: this.userHome,
            pluginPrompts,
            extraSections: resolvedPrompts.systemPromptSections
        };
        const systemPrompt = await agentSystemPrompt(systemPromptContext);

        try {
            const wrote = await agentSystemPromptWrite(this.agentSystem.config.current, this.ctx, systemPrompt);
            if (wrote) {
                logger.debug(`event: System prompt snapshot written agentId=${this.id}`);
            }
        } catch (error) {
            logger.warn({ agentId: this.id, error }, "error: Failed to write system prompt snapshot");
        }
        const contextTools: InferenceContext["tools"] = [];
        const usagePromptTokens = agentTokenPromptUsedFromUsage(this.state.tokens);
        const compactionStatus = contextCompactionStatus(
            history,
            this.agentSystem.config.current.settings.agents.emergencyContextLimit,
            {
                minimumTokens: usagePromptTokens ?? undefined,
                extras: {
                    systemPrompt,
                    tools: contextTools,
                    extraText: [rawText]
                }
            }
        );
        if (compactionStatus.severity !== "ok") {
            const target = agentDescriptorTargetResolve(this.descriptor);
            const targetId = target?.targetId ?? null;
            if (agentKind === "foreground" && connector?.capabilities.sendText && targetId) {
                await connector.sendMessage(targetId, {
                    text: messageContextReset({ kind: "compaction" }),
                    replyToMessageId: entry.context.messageId
                });
            }
            const stopCompactionTyping = this.startCompactionTypingIndicator();
            const compactionAbortController = new AbortController();
            this.inferenceAbortController = compactionAbortController;
            let compactionAborted = false;
            try {
                const compacted = await contextCompact({
                    context: this.state.context,
                    inferenceRouter: this.agentSystem.inferenceRouter,
                    providers,
                    providerId: providerId ?? undefined,
                    inferenceSessionId: this.state.inferenceSessionId ?? this.id,
                    signal: compactionAbortController.signal,
                    compactionLog: {
                        agentsDir: this.agentSystem.config.current.agentsDir,
                        agentId: this.id
                    }
                });
                const summaryMessage = compacted.messages?.[0];
                const summaryText = summaryMessage ? (messageExtractText(summaryMessage)?.trim() ?? "") : "";
                if (summaryText) {
                    compactionAt = await this.applyCompactionSummary(summaryText);
                } else {
                    logger.info({ agentId: this.id }, "event: Compaction produced empty summary; using full context");
                }
            } catch (error) {
                if (isAbortError(error, compactionAbortController.signal)) {
                    compactionAborted = true;
                    logger.info({ agentId: this.id }, "event: Compaction aborted");
                } else {
                    logger.warn(
                        { agentId: this.id, error },
                        "error: Context compaction failed; continuing with full context"
                    );
                }
            } finally {
                stopCompactionTyping?.();
                if (this.inferenceAbortController === compactionAbortController) {
                    this.inferenceAbortController = null;
                }
            }
            if (compactionAborted) {
                return null;
            }
        }

        if (pendingUserRecord) {
            if (compactionAt !== null) {
                pendingUserRecord = { ...pendingUserRecord, at: compactionAt + 1 };
            }
            await agentHistoryAppend(this.agentSystem.storage, this.ctx, pendingUserRecord);
        }

        const ctx = this.state.context;
        const contextForRun: InferenceContext & { systemPromptImages?: string[] } = {
            ...ctx,
            tools: contextTools,
            systemPrompt
        };
        if (systemPromptContext.systemPromptImages && systemPromptContext.systemPromptImages.length > 0) {
            contextForRun.systemPromptImages = systemPromptContext.systemPromptImages;
        }

        if (!contextForRun.messages) {
            contextForRun.messages = [];
        }

        logger.debug(`event: handleMessage building user message agentId=${this.id}`);
        const userMessage = await messageBuildUser(entry);
        contextForRun.messages.push(userMessage);

        const providersForAgent = providersForAgentResolve(providers, providerId);

        logger.debug(`event: handleMessage invoking inference loop agentId=${this.id}`);
        const inferenceAbortController = new AbortController();
        this.inferenceAbortController = inferenceAbortController;
        const result = await (async () => {
            try {
                return await agentLoopRun({
                    entry,
                    agent: this,
                    source,
                    context: contextForRun,
                    connector,
                    connectorRegistry: this.agentSystem.connectorRegistry,
                    inferenceRouter: this.agentSystem.inferenceRouter,
                    toolResolver,
                    authStore: this.agentSystem.authStore,
                    eventBus: this.agentSystem.eventBus,
                    assistant: this.agentSystem.config.current.settings.assistant ?? null,
                    agentSystem: this.agentSystem,
                    webhooks: this.agentSystem.webhooks,
                    skills,
                    skillsActiveRoot: this.userHome.skillsActive,
                    skillsPersonalRoot: this.userHome.skillsPersonal,
                    providersForAgent,
                    logger,
                    abortSignal: inferenceAbortController.signal,
                    appendHistoryRecord: (record) => agentHistoryAppend(this.agentSystem.storage, this.ctx, record),
                    notifySubagentFailure: (reason, error) => this.notifySubagentFailure(reason, error)
                });
            } finally {
                if (this.inferenceAbortController === inferenceAbortController) {
                    this.inferenceAbortController = null;
                }
            }
        })();

        if (result.contextOverflow) {
            logger.warn({ agentId: this.id }, "event: Inference context overflow; resetting session");
            await this.handleEmergencyReset(entry, source, result.contextOverflowTokens);
            return null;
        }

        if (result.tokenStatsUpdates.length > 0) {
            for (const update of result.tokenStatsUpdates) {
                const providerStats = this.state.stats[update.provider] ?? {};
                const modelStats = providerStats[update.model] ?? {
                    input: 0,
                    output: 0,
                    cacheRead: 0,
                    cacheWrite: 0,
                    total: 0
                };
                modelStats.input += update.size.input;
                modelStats.output += update.size.output;
                modelStats.cacheRead += update.size.cacheRead;
                modelStats.cacheWrite += update.size.cacheWrite;
                modelStats.total += update.size.total;
                providerStats[update.model] = modelStats;
                this.state.stats[update.provider] = providerStats;

                await this.agentSystem.storage.tokenStats.increment(this.ctx, {
                    at: update.at,
                    model: `${update.provider}/${update.model}`,
                    input: update.size.input,
                    output: update.size.output,
                    cacheRead: update.size.cacheRead,
                    cacheWrite: update.size.cacheWrite,
                    cost: update.cost
                });
            }
        }

        const lastAssistantRecord = [...result.historyRecords]
            .reverse()
            .find((record) => record.type === "assistant_message");
        if (lastAssistantRecord && lastAssistantRecord.type === "assistant_message") {
            this.state.tokens = lastAssistantRecord.tokens;
        }

        this.state.context = { messages: contextForRun.messages };
        this.state.updatedAt = Date.now();
        await agentStateWrite(this.agentSystem.storage, this.ctx, this.state);

        await this.invalidateSessionIfNeeded();

        return result.responseText ?? null;
    }

    private async handleSystemMessage(
        item: AgentInboxSystemMessage
    ): Promise<{ responseText: string | null; responseError?: boolean; executionErrorText?: string }> {
        let systemText = item.text;
        let executionHasError = false;
        let executionErrorText: string | null = null;
        if (item.execute) {
            if (item.code && item.code.length > 0) {
                // Execute code blocks directly via rlmExecute
                const startedAt = Date.now();
                const context: ToolExecutionContext = {
                    ...this.rlmRestoreContextBuild(item.origin ?? "system"),
                    messageContext: item.context ?? {}
                };
                const preamble = montyPreambleBuild(rlmToolsForContextResolve(this.agentSystem.toolResolver, context));
                const outputs: string[] = [];
                let skipTurn = false;
                let hasError = false;
                const errorMessages: string[] = [];
                for (let codeIdx = 0; codeIdx < item.code.length; codeIdx++) {
                    const code = item.code[codeIdx]!;
                    const codeInputs = item.inputs?.[codeIdx] ?? undefined;
                    const codeInputSchema = item.inputSchemas?.[codeIdx] ?? undefined;
                    try {
                        const result = await rlmExecute(
                            code,
                            preamble,
                            context,
                            this.agentSystem.toolResolver,
                            createId(),
                            context.appendHistoryRecord,
                            undefined,
                            codeInputs,
                            codeInputSchema
                        );
                        if (result.skipTurn) {
                            skipTurn = true;
                            break;
                        }
                        const output = result.printOutput.length > 0 ? result.printOutput.join("\n") : result.output;
                        outputs.push(output);
                    } catch (error) {
                        hasError = true;
                        const message = error instanceof Error ? error.message : String(error);
                        errorMessages.push(message);
                        outputs.push(`<exec_error>${message}</exec_error>`);
                    }
                }
                executionHasError = hasError;
                if (errorMessages.length > 0) {
                    executionErrorText = errorMessages.join("\n");
                }
                if (skipTurn) {
                    logger.info(
                        {
                            agentId: this.id,
                            origin: item.origin ?? "system",
                            codeBlockCount: item.code.length,
                            durationMs: Date.now() - startedAt
                        },
                        "event: Code execution skipped via skip()"
                    );
                    return { responseText: null };
                }

                // Sync mode: return code output directly without LLM inference
                if (item.sync) {
                    const output = outputs.join("\n\n");
                    logger.info(
                        {
                            agentId: this.id,
                            origin: item.origin ?? "system",
                            codeBlockCount: item.code.length,
                            outputCount: outputs.length,
                            hasError,
                            durationMs: Date.now() - startedAt
                        },
                        "event: Sync code execution completed"
                    );
                    return {
                        responseText: output,
                        responseError: hasError,
                        ...(hasError ? { executionErrorText: executionErrorText ?? undefined } : {})
                    };
                }

                systemText = [systemText, ...outputs].filter((s) => s.trim().length > 0).join("\n\n");
                logger.info(
                    {
                        agentId: this.id,
                        origin: item.origin ?? "system",
                        codeBlockCount: item.code.length,
                        outputCount: outputs.length,
                        durationMs: Date.now() - startedAt
                    },
                    "event: Code blocks executed"
                );
            } else {
                // Fallback: expand <run_python> tags in text
                const startedAt = Date.now();
                const runPythonTagCount = tagExtractAll(systemText, "run_python").length;
                const expandResult = await executablePromptExpand(
                    systemText,
                    {
                        ...this.rlmRestoreContextBuild(item.origin ?? "system"),
                        messageContext: item.context ?? {}
                    },
                    this.agentSystem.toolResolver
                );
                if (expandResult.skipTurn) {
                    logger.info(
                        {
                            agentId: this.id,
                            origin: item.origin ?? "system",
                            durationMs: Date.now() - startedAt
                        },
                        "event: Executable system message skipped via skip()"
                    );
                    return { responseText: null };
                }
                systemText = expandResult.expanded;
                const execErrors = tagExtractAll(systemText, "exec_error")
                    .map((entry) => entry.trim())
                    .filter(Boolean);
                const errorTagCount = execErrors.length;
                executionHasError = runPythonTagCount > 0 && errorTagCount > 0;
                if (executionHasError) {
                    executionErrorText = execErrors.join("\n");
                }
                logger.info(
                    {
                        agentId: this.id,
                        origin: item.origin ?? "system",
                        runPythonTagCount,
                        errorTagCount,
                        durationMs: Date.now() - startedAt
                    },
                    "event: Executable system message expanded"
                );
            }
        }

        const text = item.silent
            ? messageBuildSystemSilentText(systemText, item.origin)
            : messageBuildSystemText(systemText, item.origin);
        if (item.silent) {
            const receivedAt = Date.now();
            await agentHistoryAppend(this.agentSystem.storage, this.ctx, {
                type: "user_message",
                at: receivedAt,
                text,
                files: []
            });

            const context: MessageContext = {};
            const message = messageFormatIncoming({ text, files: [] }, context, new Date(receivedAt));
            const entry: AgentMessage = {
                id: createId(),
                message,
                context,
                receivedAt
            };
            const userMessage = await messageBuildUser(entry);
            if (!this.state.context.messages) {
                this.state.context.messages = [];
            }
            this.state.context.messages.push(userMessage);
            this.state.updatedAt = receivedAt;
            await agentStateWrite(this.agentSystem.storage, this.ctx, this.state);
            return {
                responseText: null,
                ...(executionHasError
                    ? { responseError: true, executionErrorText: executionErrorText ?? undefined }
                    : {})
            };
        }

        const messageItem: AgentInboxMessage = {
            type: "message",
            message: { text },
            context: item.context ?? {}
        };
        const responseText = await this.handleMessage(messageItem);
        return {
            responseText,
            ...(executionHasError ? { responseError: true, executionErrorText: executionErrorText ?? undefined } : {})
        };
    }

    private async handleSignal(item: AgentInboxSignal): Promise<{ delivered: boolean; responseText: string | null }> {
        const isInternalSignal = item.subscriptionPattern.startsWith("internal.");
        const subscription = isInternalSignal
            ? null
            : await this.agentSystem.signals.subscriptionGet({
                  ctx: this.ctx,
                  pattern: item.subscriptionPattern
              });
        if (!isInternalSignal && !subscription) {
            return { delivered: false, responseText: null };
        }
        const channelSignalData = channelSignalDataParse(item.signal.data);
        const text =
            isChannelSignalType(item.signal.type) && channelSignalData
                ? channelMessageBuild(channelSignalData)
                : signalMessageBuild(item.signal);
        const systemResult = await this.handleSystemMessage({
            type: "system_message",
            text,
            origin: `signal:${item.signal.id}`,
            silent: isInternalSignal ? false : (subscription?.silent ?? false),
            context: {}
        });
        return { delivered: true, responseText: systemResult.responseText };
    }

    private async handleReset(item: AgentInboxReset): Promise<boolean> {
        const now = Date.now();
        this.endTurnCount = 0;
        // End and invalidate old session before creating new one
        const oldSessionId = this.state.activeSessionId;
        if (oldSessionId) {
            await this.agentSystem.storage.sessions.endSession(oldSessionId, now);
            // Memory-agents must never trigger the memory worker
            if (this.descriptor.type !== "memory-agent") {
                const maxHistoryId = await this.agentSystem.storage.history.maxId(oldSessionId);
                if (maxHistoryId !== null) {
                    await this.agentSystem.storage.sessions.invalidate(oldSessionId, maxHistoryId);
                }
            }
        }
        const resetMessage = item.message?.trim() ?? "";
        if (resetMessage.length > 0) {
            this.state.context = {
                messages: [buildResetSystemMessage(resetMessage, now, this.id)]
            };
        } else {
            this.state.context = { messages: [] };
        }
        this.state.inferenceSessionId = createId();
        this.state.activeSessionId = await this.agentSystem.storage.sessions.create({
            agentId: this.id,
            inferenceSessionId: this.state.inferenceSessionId,
            createdAt: now,
            resetMessage: resetMessage.length > 0 ? resetMessage : null
        });
        this.state.tokens = null;
        this.state.updatedAt = now;
        this.documentLastReadVersions.clear();
        await agentStateWrite(this.agentSystem.storage, this.ctx, this.state);
        this.agentSystem.eventBus.emit("agent.reset", {
            agentId: this.id,
            context: item.context ?? {}
        });

        if (this.descriptor.type !== "user") {
            return true;
        }
        if (!item.context) {
            return true;
        }

        const connector = this.agentSystem.connectorRegistry.get(this.descriptor.connector);
        if (!connector?.capabilities.sendText) {
            return true;
        }

        try {
            await connector.sendMessage(this.descriptor.channelId, {
                text: messageContextReset({ kind: "manual" }),
                replyToMessageId: item.context?.messageId
            });
        } catch (error) {
            logger.warn({ agentId: this.id, error }, "error: Reset confirmation send failed");
        }
        return true;
    }

    private async handleCompaction(item: AgentInboxCompact): Promise<boolean> {
        const result = await this.runManualCompaction();
        if (this.descriptor.type !== "user") {
            return result.ok;
        }
        const connector = this.agentSystem.connectorRegistry.get(this.descriptor.connector);
        if (!connector?.capabilities.sendText) {
            return result.ok;
        }
        const text = this.compactionResultText(result);
        try {
            await connector.sendMessage(this.descriptor.channelId, {
                text,
                replyToMessageId: item.context?.messageId
            });
        } catch (error) {
            logger.warn({ agentId: this.id, error }, "error: Compaction command response failed");
        }
        return result.ok;
    }

    /**
     * Resets the session when the emergency context limit is exceeded.
     * Expects: reset record written and state persisted before notifying users.
     */
    private async handleEmergencyReset(
        entry: AgentMessage,
        source: string,
        contextOverflowTokens?: number
    ): Promise<void> {
        const estimatedTokens =
            typeof contextOverflowTokens === "number" && contextOverflowTokens > 0
                ? contextOverflowTokens
                : contextEstimateTokens(await agentHistoryLoad(this.agentSystem.storage, this.ctx));

        const reset: AgentInboxReset = {
            type: "reset",
            message: "Emergency reset: context overflow detected. Previous session context was cleared."
        };
        await this.handleReset(reset);

        if (this.resolveAgentKind() !== "foreground") {
            return;
        }

        const target = agentDescriptorTargetResolve(this.descriptor);
        const targetId = target?.targetId ?? null;
        if (!targetId) {
            return;
        }

        const connector = this.agentSystem.connectorRegistry.get(source);
        if (!connector?.capabilities.sendText) {
            return;
        }

        try {
            await connector.sendMessage(targetId, {
                text: messageContextReset({ kind: "overflow", estimatedTokens }),
                replyToMessageId: entry.context.messageId
            });
        } catch (error) {
            logger.warn({ agentId: this.id, error }, "error: Failed to notify user about emergency reset");
        }
    }

    private async handleRestore(_item: AgentInboxRestore): Promise<boolean> {
        try {
            await this.completePendingToolCalls("session_crashed");
            const history = await agentHistoryLoad(this.agentSystem.storage, this.ctx);
            const historyMessages = await this.buildHistoryContext(history);
            this.state.context = {
                messages: historyMessages
            };
            this.state.updatedAt = Date.now();
            await agentStateWrite(this.agentSystem.storage, this.ctx, this.state);
        } catch (error) {
            logger.warn({ agentId: this.id, error }, "restore: History restore failed; starting from scratch");
            await this.handleReset({
                type: "reset",
                message: RESTORE_FAILURE_RESET_MESSAGE
            });
            await this.restoreFailureNotificationSend(RESTORE_FAILURE_RESET_MESSAGE);
        }
        this.agentSystem.eventBus.emit("agent.restored", { agentId: this.id });
        return true;
    }

    private async restoreFailureNotificationSend(text: string): Promise<void> {
        if (this.resolveAgentKind() !== "foreground") {
            return;
        }
        const target = agentDescriptorTargetResolve(this.descriptor);
        if (!target) {
            return;
        }
        const targetId = target?.targetId ?? null;
        if (!targetId) {
            return;
        }
        const connector = this.agentSystem.connectorRegistry.get(target.connector);
        if (!connector?.capabilities.sendText) {
            return;
        }
        try {
            await connector.sendMessage(targetId, { text });
        } catch (error) {
            logger.warn({ agentId: this.id, error }, "error: Failed to send restore failure notification");
        }
    }

    private async runManualCompaction(): Promise<{ ok: boolean; reason?: string }> {
        const messages = this.state.context.messages ?? [];
        if (messages.length === 0) {
            return { ok: false, reason: "empty" };
        }
        const { providers, providerId } = this.inferenceProvidersResolve();
        if (providers.length === 0) {
            return { ok: false, reason: "no_provider" };
        }
        const stopCompactionTyping = this.startCompactionTypingIndicator();
        const compactionAbortController = new AbortController();
        this.inferenceAbortController = compactionAbortController;
        try {
            const compacted = await contextCompact({
                context: this.state.context,
                inferenceRouter: this.agentSystem.inferenceRouter,
                providers,
                providerId: providerId ?? undefined,
                inferenceSessionId: this.state.inferenceSessionId ?? this.id,
                signal: compactionAbortController.signal,
                compactionLog: {
                    agentsDir: this.agentSystem.config.current.agentsDir,
                    agentId: this.id
                }
            });
            const summaryMessage = compacted.messages?.[0];
            const summaryText = summaryMessage ? (messageExtractText(summaryMessage)?.trim() ?? "") : "";
            if (!summaryText) {
                return { ok: false, reason: "empty_summary" };
            }
            const compactionAt = await this.applyCompactionSummary(summaryText);
            this.state.updatedAt = compactionAt;
            await agentStateWrite(this.agentSystem.storage, this.ctx, this.state);
            return { ok: true };
        } catch (error) {
            if (isAbortError(error, compactionAbortController.signal)) {
                logger.info({ agentId: this.id }, "event: Manual compaction aborted");
                return { ok: false, reason: "aborted" };
            }
            logger.warn({ agentId: this.id, error }, "error: Manual compaction failed");
            return { ok: false, reason: "failed" };
        } finally {
            stopCompactionTyping?.();
            if (this.inferenceAbortController === compactionAbortController) {
                this.inferenceAbortController = null;
            }
        }
    }

    private compactionResultText(result: { ok: boolean; reason?: string }): string {
        if (result.ok) {
            return "Session compacted.";
        }
        switch (result.reason) {
            case "empty":
                return "Nothing to compact yet.";
            case "empty_summary":
                return "Compaction produced an empty summary; context unchanged.";
            case "no_provider":
                return "Compaction unavailable: no inference provider configured.";
            case "aborted":
                return "Compaction aborted.";
            default:
                return "Compaction failed.";
        }
    }

    /**
     * Completes dangling tool calls from persisted history with a synthetic result.
     * Expects: called before rebuilding context or starting a new inference loop.
     */
    private async completePendingToolCalls(reason: "session_crashed" | "user_aborted"): Promise<void> {
        const records = await agentHistoryLoad(this.agentSystem.storage, this.ctx);
        const pendingPhase = reason === "session_crashed" ? agentLoopPendingPhaseResolve(records) : null;
        if (!pendingPhase) {
            return;
        }

        const appendRecord = async (record: AgentHistoryRecord): Promise<void> => {
            await agentHistoryAppend(this.agentSystem.storage, this.ctx, record);
            records.push(record);
        };
        const initialPhase = pendingPhase.type === "error" ? undefined : pendingPhase;
        if (pendingPhase.type === "error") {
            const completionMessage = pendingPhase.message;
            await appendRecord(
                rlmHistoryCompleteErrorRecordBuild(pendingPhase.start.toolCallId, completionMessage, [], 0)
            );
        }

        const source = this.sourceResolve();
        const connector = this.agentSystem.connectorRegistry.get(source);
        const { providers, providerId } = this.inferenceProvidersResolve();
        const providersForAgent = providersForAgentResolve(providers, providerId);
        const skills = this.skillsResolve();
        const pendingContext: InferenceContext = {
            messages: await this.buildHistoryContext(records)
        };
        const entry: AgentMessage = {
            id: createId(),
            receivedAt: Date.now(),
            context: {},
            message: {
                text: "",
                rawText: "",
                files: []
            }
        };
        await agentLoopRun({
            entry,
            agent: this,
            source,
            context: pendingContext,
            connector,
            connectorRegistry: this.agentSystem.connectorRegistry,
            inferenceRouter: this.agentSystem.inferenceRouter,
            toolResolver: this.agentSystem.toolResolver,
            authStore: this.agentSystem.authStore,
            eventBus: this.agentSystem.eventBus,
            assistant: this.agentSystem.config.current.settings.assistant ?? null,
            agentSystem: this.agentSystem,
            webhooks: this.agentSystem.webhooks,
            skills,
            skillsActiveRoot: this.userHome.skillsActive,
            skillsPersonalRoot: this.userHome.skillsPersonal,
            providersForAgent,
            logger,
            appendHistoryRecord: (record) => agentHistoryAppend(this.agentSystem.storage, this.ctx, record),
            notifySubagentFailure: (failureReason, error) => this.notifySubagentFailure(failureReason, error),
            initialPhase,
            stopAfterPendingPhase: false
        });

        const history = await agentHistoryLoad(this.agentSystem.storage, this.ctx);
        const historyMessages = await this.buildHistoryContext(history);
        this.state.context = {
            messages: historyMessages
        };
        this.state.updatedAt = Date.now();
        await agentStateWrite(this.agentSystem.storage, this.ctx, this.state);
        logger.warn(
            {
                agentId: this.id,
                reason,
                phase: pendingPhase.type
            },
            "event: Completed pending loop phase in history"
        );
    }

    private rlmRestoreContextBuild(source: string): ToolExecutionContext {
        const allowedToolNames = agentToolExecutionAllowlistResolve(this.descriptor);

        return {
            connectorRegistry: this.agentSystem.connectorRegistry,
            sandbox: this.sandbox,
            auth: this.agentSystem.authStore,
            logger,
            assistant: this.agentSystem.config.current.settings.assistant ?? null,
            agent: this,
            ctx: this.ctx,
            source,
            messageContext: {},
            agentSystem: this.agentSystem,
            storage: this.agentSystem.storage,
            webhooks: this.agentSystem.webhooks,
            secrets: this.agentSystem.secrets,
            toolResolver: this.agentSystem.toolResolver,
            skills: [],
            allowedToolNames
        };
    }

    /**
     * Notifies a parent agent when a child background agent fails.
     * Expects: parent agent exists.
     */
    async notifySubagentFailure(reason: string, error?: unknown): Promise<void> {
        if (this.descriptor.type !== "subagent" && this.descriptor.type !== "app") {
            return;
        }
        const parentAgentId = this.descriptor.parentAgentId ?? null;
        if (!parentAgentId) {
            logger.warn({ agentId: this.id }, "event: Child agent missing parent agent");
            return;
        }
        const name = this.descriptor.name ?? this.descriptor.type;
        const descriptorType = this.descriptor.type;
        const errorText = error instanceof Error ? error.message : error ? String(error) : "";
        const detail = errorText ? `${reason} (${errorText})` : reason;
        try {
            await this.agentSystem.post(
                this.ctx,
                { agentId: parentAgentId },
                {
                    type: "system_message",
                    text: `${descriptorType} ${name} (${this.id}) failed: ${detail}.`,
                    origin: this.id
                }
            );
        } catch (sendError) {
            logger.warn(
                { agentId: this.id, parentAgentId, error: sendError },
                "error: Child agent failure notification failed"
            );
        }
    }

    private resolveAgentKind(): "background" | "foreground" {
        if (this.descriptor.type === "user" || this.descriptor.type === "subuser") {
            return "foreground";
        }
        return "background";
    }

    private sourceResolve(): string {
        return this.descriptor.type === "user"
            ? this.descriptor.connector
            : this.descriptor.type === "system"
              ? this.descriptor.tag
              : this.descriptor.type;
    }

    private inferenceProvidersResolve(): {
        providers: ReturnType<typeof listActiveInferenceProviders>;
        providerId: string | null;
    } {
        const rawProviders = listActiveInferenceProviders(this.agentSystem.config.current.settings);
        const roleKey = agentDescriptorRoleResolve(this.descriptor);
        const roleConfig = roleKey ? this.agentSystem.config.current.settings.models?.[roleKey] : undefined;
        const roleApplied = modelRoleApply(rawProviders, roleConfig);
        const roleProviders = roleApplied.providers;
        const providerId = roleApplied.providerId ?? this.resolveAgentProvider(roleProviders);
        const providers = agentModelOverrideApply(
            roleProviders,
            this.state.modelOverride,
            providerId,
            this.agentSystem.config.current.settings.modelFlavors
        );
        return { providers, providerId };
    }

    private skillsResolve(): Skills {
        const configSkillsRoot = path.join(this.agentSystem.config.current.configDir, "skills");
        return new Skills({
            configRoot: configSkillsRoot,
            pluginManager: this.agentSystem.pluginManager,
            userPersonalRoot: this.userHome.skillsPersonal,
            userActiveRoot: this.userHome.skillsActive,
            agentsRoot: path.join(os.homedir(), ".agents", "skills")
        });
    }

    private resolveAgentProvider(providers: ReturnType<typeof listActiveInferenceProviders>): string | null {
        const activeIds = new Set(providers.map((provider) => provider.id));

        let providerId = this.providerId ?? null;
        if (!providerId || !activeIds.has(providerId)) {
            providerId = providers[0]?.id ?? null;
        }

        if (providerId && this.providerId !== providerId) {
            this.providerId = providerId;
        }

        return providerId;
    }

    /**
     * Starts typing indication for foreground user agents during long compaction operations.
     * Expects: connector supports startTyping for the active target.
     */
    private startCompactionTypingIndicator(): (() => void) | null {
        if (this.descriptor.type !== "user") {
            return null;
        }
        const target = agentDescriptorTargetResolve(this.descriptor);
        if (!target?.targetId) {
            return null;
        }
        const connector = this.agentSystem.connectorRegistry.get(target.connector);
        return connector?.startTyping?.(target.targetId) ?? null;
    }

    private async buildHistoryContext(records: AgentHistoryRecord[]): Promise<InferenceContext["messages"]> {
        return agentHistoryContext(records, this.id);
    }

    private async applyCompactionSummary(summaryText: string): Promise<number> {
        const summaryWithContinue = `${summaryText}\n\nPlease continue with the user's latest request.`;
        const compactionAt = Date.now();
        const resetMessage = "Session context compacted.";
        this.endTurnCount = 0;
        // End and invalidate old session before creating new one
        const oldSessionId = this.state.activeSessionId;
        if (oldSessionId) {
            await this.agentSystem.storage.sessions.endSession(oldSessionId, compactionAt);
            // Memory-agents must never trigger the memory worker
            if (this.descriptor.type !== "memory-agent") {
                const maxHistoryId = await this.agentSystem.storage.history.maxId(oldSessionId);
                if (maxHistoryId !== null) {
                    await this.agentSystem.storage.sessions.invalidate(oldSessionId, maxHistoryId);
                }
            }
        }
        this.state.context = {
            messages: [
                buildResetSystemMessage(resetMessage, compactionAt, this.id),
                {
                    role: "user",
                    content: summaryWithContinue,
                    timestamp: compactionAt
                }
            ]
        };
        this.state.inferenceSessionId = createId();
        this.state.activeSessionId = await this.agentSystem.storage.sessions.create({
            agentId: this.id,
            inferenceSessionId: this.state.inferenceSessionId,
            createdAt: compactionAt,
            resetMessage
        });
        this.state.tokens = null;
        this.documentLastReadVersions.clear();
        await agentStateWrite(this.agentSystem.storage, this.ctx, this.state);
        await agentHistoryAppend(this.agentSystem.storage, this.ctx, {
            type: "user_message",
            at: compactionAt,
            text: summaryWithContinue,
            files: []
        });
        return compactionAt;
    }
}

function isChannelSignalType(type: string): boolean {
    return type.startsWith("channel.") && type.endsWith(":message");
}

function toFileReferences(
    files: Array<{ id: string; name: string; path: string; mimeType: string; size: number }>
): Array<{ id: string; name: string; path: string; mimeType: string; size: number }> {
    return files.map((file) => ({
        id: file.id,
        name: file.name,
        path: file.path,
        mimeType: file.mimeType,
        size: file.size
    }));
}

function buildResetSystemMessage(text: string, at: number, origin: string): InferenceContext["messages"][number] {
    return {
        role: "user",
        content: messageBuildSystemText(text, origin),
        timestamp: at
    };
}

function providersForAgentResolve(
    providers: ReturnType<typeof listActiveInferenceProviders>,
    providerId: string | null
): ReturnType<typeof listActiveInferenceProviders> {
    const selected = providerId ? providers.filter((provider) => provider.id === providerId) : providers;
    if (selected.length > 0) {
        return selected;
    }
    return providers;
}

function isAbortError(error: unknown, signal?: AbortSignal): boolean {
    if (signal?.aborted) {
        return true;
    }
    if (error instanceof Error) {
        return error.name === "AbortError" || error.message.toLowerCase().includes("abort");
    }
    return false;
}
