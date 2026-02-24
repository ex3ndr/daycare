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
import { RLM_TOOL_NAME } from "../modules/rlm/rlmConstants.js";
import { rlmErrorTextBuild } from "../modules/rlm/rlmErrorTextBuild.js";
import { rlmHistoryCompleteErrorRecordBuild } from "../modules/rlm/rlmHistoryCompleteErrorRecordBuild.js";
import { rlmNoToolsModeIs } from "../modules/rlm/rlmNoToolsModeIs.js";
import { rlmRestore } from "../modules/rlm/rlmRestore.js";
import { rlmResultTextBuild } from "../modules/rlm/rlmResultTextBuild.js";
import { rlmToolDescriptionBuild } from "../modules/rlm/rlmToolDescriptionBuild.js";
import { rlmToolResultBuild } from "../modules/rlm/rlmToolResultBuild.js";
import type { ToolResolverApi } from "../modules/toolResolver.js";
import { toolListContextBuild } from "../modules/tools/toolListContextBuild.js";
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
import { agentHistoryPendingRlmResolve } from "./ops/agentHistoryPendingRlmResolve.js";
import { agentHistoryPendingToolResults } from "./ops/agentHistoryPendingToolResults.js";
import type { AgentInbox } from "./ops/agentInbox.js";
import { agentLoopRun } from "./ops/agentLoopRun.js";
import { agentModelOverrideApply } from "./ops/agentModelOverrideApply.js";
import { agentPromptFilesEnsure } from "./ops/agentPromptFilesEnsure.js";
import { agentPromptPathsResolve } from "./ops/agentPromptPathsResolve.js";
import { agentStateWrite } from "./ops/agentStateWrite.js";
import { type AgentSystemPromptContext, agentSystemPrompt } from "./ops/agentSystemPrompt.js";
import { agentSystemPromptWrite } from "./ops/agentSystemPromptWrite.js";
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
import { contextCompact } from "./ops/contextCompact.js";
import { contextCompactionStatus } from "./ops/contextCompactionStatus.js";
import { contextEstimateTokens } from "./ops/contextEstimateTokens.js";
import { messageContextReset } from "./ops/messageContextReset.js";
import { systemPromptResolve } from "./ops/systemPromptResolve.js";

const logger = getLogger("engine.agent");

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
        this.sandbox = new Sandbox({
            homeDir: this.userHome.home,
            permissions: this.state.permissions,
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
                      userId: this.ctx.userId,
                      skillsActiveDir: this.userHome.skillsActive
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
                const responseText = await this.handleSystemMessage(item);
                return { type: "system_message", responseText };
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
        const source =
            this.descriptor.type === "user"
                ? this.descriptor.connector
                : this.descriptor.type === "system"
                  ? this.descriptor.tag
                  : this.descriptor.type;
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
            files
        };

        await this.completePendingToolCalls("session_crashed");

        const rawProviders = listActiveInferenceProviders(this.agentSystem.config.current.settings);
        const roleKey = agentDescriptorRoleResolve(this.descriptor);
        const roleConfig = roleKey ? this.agentSystem.config.current.settings.models?.[roleKey] : undefined;
        const roleApplied = modelRoleApply(rawProviders, roleConfig);
        const roleProviders = roleApplied.providers;
        const providerId = roleApplied.providerId ?? this.resolveAgentProvider(roleProviders);
        const providers = agentModelOverrideApply(roleProviders, this.state.modelOverride, providerId);

        const connector = this.agentSystem.connectorRegistry.get(source);
        const pluginManager = this.agentSystem.pluginManager;
        const configSkillsRoot = path.join(this.agentSystem.config.current.configDir, "skills");
        const skills = new Skills({
            configRoot: configSkillsRoot,
            pluginManager,
            userPersonalRoot: this.userHome.skillsPersonal,
            userActiveRoot: this.userHome.skillsActive,
            agentsRoot: path.join(os.homedir(), ".agents", "skills")
        });
        const agentKind = this.resolveAgentKind();

        const toolResolver = this.agentSystem.toolResolver;
        const providerSettings = providerId ? providers.find((provider) => provider.id === providerId) : providers[0];
        const visibleTools = toolResolver.listToolsForAgent({
            ctx: this.ctx,
            descriptor: this.descriptor
        });
        const noToolsModeEnabled = rlmNoToolsModeIs(this.agentSystem.config.current.features);
        const rlmToolDescription =
            this.agentSystem.config.current.features.rlm && !noToolsModeEnabled
                ? await rlmToolDescriptionBuild(visibleTools)
                : undefined;

        const history = await agentHistoryLoad(this.agentSystem.storage, this.ctx);
        const isFirstMessage = history.length === 0;

        // Resolve configured system prompts (global, per-user, conditional)
        const resolvedPrompts = await systemPromptResolve(this.agentSystem.storage, this.ctx.userId, isFirstMessage);

        // Prepend first-message prompt to user message text if applicable
        if (resolvedPrompts.firstMessagePrompt && entry.message.text !== null) {
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
        const contextTools = await this.listContextTools(toolResolver, source, {
            agentKind,
            rlmToolDescription
        });
        const compactionStatus = contextCompactionStatus(
            history,
            this.agentSystem.config.current.settings.agents.emergencyContextLimit,
            {
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

        const providersForAgent = providerId ? providers.filter((provider) => provider.id === providerId) : [];

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
                    heartbeats: this.agentSystem.heartbeats,
                    memory: this.agentSystem.memory,
                    skills,
                    skillsActiveRoot: this.userHome.skillsActive,
                    skillsPersonalRoot: this.userHome.skillsPersonal,
                    providersForAgent,
                    verbose: this.agentSystem.config.current.verbose,
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

    private async handleSystemMessage(item: AgentInboxSystemMessage): Promise<string | null> {
        let systemText = item.text;
        if (item.execute) {
            if (!this.agentSystem.config.current.features.rlm) {
                logger.debug(
                    { agentId: this.id, origin: item.origin ?? "system" },
                    "skip: Executable system message skipped because RLM is disabled"
                );
            } else {
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
                    return null;
                }
                systemText = expandResult.expanded;
                const errorTagCount = tagExtractAll(systemText, "exec_error").length;
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
            return null;
        }

        const messageItem: AgentInboxMessage = {
            type: "message",
            message: { text },
            context: item.context ?? {}
        };
        return this.handleMessage(messageItem);
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
        const responseText = await this.handleSystemMessage({
            type: "system_message",
            text,
            origin: `signal:${item.signal.id}`,
            silent: isInternalSignal ? false : (subscription?.silent ?? false),
            context: {}
        });
        return { delivered: true, responseText };
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
        await this.completePendingToolCalls("session_crashed");
        const history = await agentHistoryLoad(this.agentSystem.storage, this.ctx);
        const historyMessages = await this.buildHistoryContext(history);
        this.state.context = {
            messages: historyMessages
        };
        this.state.updatedAt = Date.now();
        await agentStateWrite(this.agentSystem.storage, this.ctx, this.state);
        this.agentSystem.eventBus.emit("agent.restored", { agentId: this.id });
        return true;
    }

    private async runManualCompaction(): Promise<{ ok: boolean; reason?: string }> {
        const messages = this.state.context.messages ?? [];
        if (messages.length === 0) {
            return { ok: false, reason: "empty" };
        }
        const rawCompactionProviders = listActiveInferenceProviders(this.agentSystem.config.current.settings);
        if (rawCompactionProviders.length === 0) {
            return { ok: false, reason: "no_provider" };
        }
        const roleKey = agentDescriptorRoleResolve(this.descriptor);
        const roleConfig = roleKey ? this.agentSystem.config.current.settings.models?.[roleKey] : undefined;
        const roleApplied = modelRoleApply(rawCompactionProviders, roleConfig);
        const providerId = roleApplied.providerId ?? this.resolveAgentProvider(roleApplied.providers);
        const providers = agentModelOverrideApply(roleApplied.providers, this.state.modelOverride, providerId);
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
        const pendingRlm = reason === "session_crashed" ? agentHistoryPendingRlmResolve(records) : null;
        const pendingRlmToolCallId = pendingRlm?.start.toolCallId ?? null;
        const completionRecords = agentHistoryPendingToolResults(records, reason, Date.now()).filter(
            (record) =>
                !(pendingRlmToolCallId && record.type === "tool_result" && record.toolCallId === pendingRlmToolCallId)
        );
        let completedToolCalls = 0;
        for (const record of completionRecords) {
            await agentHistoryAppend(this.agentSystem.storage, this.ctx, record);
            records.push(record);
            completedToolCalls += 1;
        }

        if (pendingRlm) {
            const appendRecord = async (record: AgentHistoryRecord): Promise<void> => {
                await agentHistoryAppend(this.agentSystem.storage, this.ctx, record);
                records.push(record);
            };
            const toolCall = pendingRlm.start.toolCallId;
            let toolResultText = "";
            let toolResultIsError = false;
            let restoreMessage = "RLM execution completed after restart. Output: (empty)";

            if (!pendingRlm.lastSnapshot) {
                const message = "Process was restarted before any tool call";
                await appendRecord(rlmHistoryCompleteErrorRecordBuild(toolCall, message));
                toolResultText = rlmErrorTextBuild(new Error(message));
                toolResultIsError = true;
                restoreMessage = `RLM execution failed after restart. ${message}`;
            } else {
                const source =
                    this.descriptor.type === "user"
                        ? this.descriptor.connector
                        : this.descriptor.type === "system"
                          ? this.descriptor.tag
                          : this.descriptor.type;
                try {
                    // Create steering check callback that consumes steering if present
                    const checkSteering = () => {
                        const steering = this.inbox.consumeSteering();
                        if (steering) {
                            return { text: steering.text, origin: steering.origin };
                        }
                        return null;
                    };
                    const restored = await rlmRestore(
                        pendingRlm.lastSnapshot,
                        pendingRlm.start,
                        this.agentSystem.toolResolver,
                        this.rlmRestoreContextBuild(source),
                        appendRecord,
                        checkSteering
                    );
                    toolResultText = rlmResultTextBuild(restored);
                    restoreMessage = `RLM execution completed after restart. Output: ${
                        restored.output.length > 0 ? restored.output : "(empty)"
                    }`;
                } catch (error) {
                    const message = error instanceof Error ? error.message : String(error);
                    await appendRecord(
                        rlmHistoryCompleteErrorRecordBuild(
                            toolCall,
                            message,
                            pendingRlm.lastSnapshot.printOutput,
                            pendingRlm.lastSnapshot.toolCallCount
                        )
                    );
                    toolResultText = rlmErrorTextBuild(error);
                    toolResultIsError = true;
                    restoreMessage = `RLM execution failed after restart. ${message}`;
                }
            }

            const result = rlmToolResultBuild({ id: toolCall, name: RLM_TOOL_NAME }, toolResultText, toolResultIsError);
            await appendRecord({
                type: "tool_result",
                at: Date.now(),
                toolCallId: toolCall,
                output: result
            });
            await appendRecord({
                type: "user_message",
                at: Date.now(),
                text: messageBuildSystemText(restoreMessage, "rlm_restore"),
                files: []
            });
            completedToolCalls += 1;
        }

        if (completedToolCalls > 0) {
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
                    completedToolCalls
                },
                "event: Completed pending tool calls in history"
            );
        }
    }

    private rlmRestoreContextBuild(source: string): ToolExecutionContext {
        const allowedToolNames = agentToolExecutionAllowlistResolve(this.descriptor, {
            rlmEnabled: this.agentSystem.config.current.features.rlm
        });

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
            heartbeats: this.agentSystem.heartbeats,
            memory: this.agentSystem.memory,
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

    private async listContextTools(
        toolResolver: ToolResolverApi,
        source?: string,
        options?: {
            agentKind?: "background" | "foreground";
            rlmToolDescription?: string;
        }
    ): Promise<InferenceContext["tools"]> {
        const tools = toolResolver.listToolsForAgent({
            ctx: this.ctx,
            descriptor: this.descriptor
        });
        const noToolsModeEnabled = rlmNoToolsModeIs(this.agentSystem.config.current.features);
        let rlmToolDescription = options?.rlmToolDescription;
        if (!rlmToolDescription && this.agentSystem.config.current.features.rlm && !noToolsModeEnabled) {
            rlmToolDescription = await rlmToolDescriptionBuild(tools);
        }

        return toolListContextBuild({
            tools,
            source,
            agentKind: options?.agentKind,
            noTools: noToolsModeEnabled,
            rlm: this.agentSystem.config.current.features.rlm,
            rlmToolDescription,
            connectorRegistry: this.agentSystem.connectorRegistry,
            imageRegistry: this.agentSystem.imageRegistry,
            mediaRegistry: this.agentSystem.mediaRegistry
        });
    }

    private resolveAgentKind(): "background" | "foreground" {
        if (this.descriptor.type === "user" || this.descriptor.type === "subuser") {
            return "foreground";
        }
        return "background";
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

function isAbortError(error: unknown, signal?: AbortSignal): boolean {
    if (signal?.aborted) {
        return true;
    }
    if (error instanceof Error) {
        return error.name === "AbortError" || error.message.toLowerCase().includes("abort");
    }
    return false;
}
