import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";

import type { Context, ToolCall } from "@mariozechner/pi-ai";
import { createId } from "@paralleldrive/cuid2";
import Handlebars from "handlebars";

import { getLogger } from "../../log.js";
import {
  DEFAULT_AGENTS_PATH,
  DEFAULT_MEMORY_PATH,
  DEFAULT_SOUL_PATH,
  DEFAULT_TOOLS_PATH,
  DEFAULT_USER_PATH
} from "../../paths.js";
import { listActiveInferenceProviders } from "../../providers/catalog.js";
import { cuid2Is } from "../../utils/cuid2Is.js";
import { agentPromptBundledRead } from "./ops/agentPromptBundledRead.js";
import { agentPromptFilesEnsure } from "./ops/agentPromptFilesEnsure.js";
import type { AgentSkill, MessageContext } from "@/types";
import { messageBuildUser } from "../messages/messageBuildUser.js";
import { messageFormatIncoming } from "../messages/messageFormatIncoming.js";
import { messageBuildSystemText } from "../messages/messageBuildSystemText.js";
import { messageExtractText } from "../messages/messageExtractText.js";
import { contextCompact } from "./ops/contextCompact.js";
import { contextCompactionStatusBuild } from "./ops/contextCompactionStatusBuild.js";
import { contextEstimateTokens } from "./ops/contextEstimateTokens.js";
import { messageContextReset } from "./ops/messageContextReset.js";
import { permissionClone } from "../permissions/permissionClone.js";
import { permissionEnsureDefaultFile } from "../permissions/permissionEnsureDefaultFile.js";
import { permissionMergeDefault } from "../permissions/permissionMergeDefault.js";
import { permissionTagsApply } from "../permissions/permissionTagsApply.js";
import { skillPromptFormat } from "../skills/skillPromptFormat.js";
import { Skills } from "../skills/skills.js";
import { toolListContextBuild } from "../modules/tools/toolListContextBuild.js";
import { agentPermanentList } from "./ops/agentPermanentList.js";
import { agentPermanentPromptBuild } from "./ops/agentPermanentPromptBuild.js";
import { agentDescriptorIsCron } from "./ops/agentDescriptorIsCron.js";
import { agentDescriptorIsHeartbeat } from "./ops/agentDescriptorIsHeartbeat.js";
import { agentDescriptorTargetResolve } from "./ops/agentDescriptorTargetResolve.js";
import type { AgentDescriptor } from "./ops/agentDescriptorTypes.js";
import type {
  AgentHistoryRecord,
  AgentInboxItem,
  AgentInboxMessage,
  AgentInboxSignal,
  AgentInboxSystemMessage,
  AgentInboxReset,
  AgentInboxCompact,
  AgentInboxRestore,
  AgentInboxResult,
  AgentMessage,
  AgentState
} from "./ops/agentTypes.js";
import { agentLoopRun } from "./ops/agentLoopRun.js";
import { AgentInbox } from "./ops/agentInbox.js";
import { agentHistoryAppend } from "./ops/agentHistoryAppend.js";
import { agentHistoryLoad } from "./ops/agentHistoryLoad.js";
import { agentHistoryLoadAll } from "./ops/agentHistoryLoadAll.js";
import { agentStateWrite } from "./ops/agentStateWrite.js";
import { agentDescriptorWrite } from "./ops/agentDescriptorWrite.js";
import { agentSystemPromptWrite } from "./ops/agentSystemPromptWrite.js";
import { agentRestoreContextResolve } from "./ops/agentRestoreContextResolve.js";
import { agentHistoryPendingToolResultsBuild } from "./ops/agentHistoryPendingToolResultsBuild.js";
import { signalMessageBuild } from "../signals/signalMessageBuild.js";
import { channelMessageBuild, channelSignalDataParse } from "../channels/channelMessageBuild.js";
import type { AgentSystem } from "./agentSystem.js";
import { systemAgentPromptResolve } from "./system/systemAgentPromptResolve.js";

const logger = getLogger("engine.agent");

export class Agent {
  readonly id: string;
  readonly descriptor: AgentDescriptor;
  readonly inbox: AgentInbox;
  readonly state: AgentState;
  private readonly agentSystem: AgentSystem;
  private providerId: string | null = null;
  private processing = false;
  private started = false;
  private inferenceAbortController: AbortController | null = null;

  private constructor(
    id: string,
    descriptor: AgentDescriptor,
    state: AgentState,
    inbox: AgentInbox,
    agentSystem: AgentSystem
  ) {
    this.id = id;
    this.descriptor = descriptor;
    this.state = state;
    this.inbox = inbox;
    this.agentSystem = agentSystem;
  }

  /**
   * Creates a new agent and persists descriptor + state + history start.
   * Expects: agentId is a cuid2 value; descriptor is validated.
   */
  static async create(
    agentId: string,
    descriptor: AgentDescriptor,
    inbox: AgentInbox,
    agentSystem: AgentSystem
  ): Promise<Agent> {
    if (!cuid2Is(agentId)) {
      throw new Error("Agent id must be a cuid2 value.");
    }
    const now = Date.now();
    const state: AgentState = {
      context: { messages: [] },
      inferenceSessionId: createId(),
      permissions: permissionClone(agentSystem.config.current.defaultPermissions),
      tokens: null,
      stats: {},
      createdAt: now,
      updatedAt: now,
      state: "active"
    };

    const agent = new Agent(agentId, descriptor, state, inbox, agentSystem);
    await agentDescriptorWrite(agentSystem.config.current, agentId, descriptor);
    await agentStateWrite(agentSystem.config.current, agentId, state);
    await agentHistoryAppend(agentSystem.config.current, agentId, {
      type: "start",
      at: now
    });

    agent.agentSystem.eventBus.emit("agent.created", {
      agentId,
      source: "agent",
      context: {}
    });
    return agent;
  }

  /**
   * Rehydrates an agent from persisted descriptor + state.
   * Expects: state and descriptor already validated.
   */
  static restore(
    agentId: string,
    descriptor: AgentDescriptor,
    state: AgentState,
    inbox: AgentInbox,
    agentSystem: AgentSystem
  ): Agent {
    return new Agent(agentId, descriptor, state, inbox, agentSystem);
  }

  start(): void {
    if (this.started) {
      return;
    }
    this.started = true;
    logger.debug(
      `start: Agent loop starting agentId=${this.id} type=${this.descriptor.type}`
    );
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
        logger.debug(
          `event: Agent inbox item dequeued agentId=${this.id} type=${entry.item.type}`
        );
        this.processing = true;
        try {
          const result = await this.agentSystem.inReadLock(async () =>
            this.handleInboxItem(entry.item)
          );
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
      logger.warn(
        { agentId: this.id, error: failure },
        "error: Failed to send unexpected error message"
      );
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
    let compactionAt: number | null = null;
    let pendingUserRecord: AgentHistoryRecord | null = {
      type: "user_message",
      at: receivedAt,
      text: rawText,
      files
    };

    await this.completePendingToolCalls("session_crashed");

    const providers = listActiveInferenceProviders(this.agentSystem.config.current.settings);
    const providerId = this.resolveAgentProvider(providers);

    const connector = this.agentSystem.connectorRegistry.get(source);
    const connectorCapabilities = connector?.capabilities ?? null;
    const fileSendModes = connectorCapabilities?.sendFiles?.modes ?? [];
    const cronTasks = await this.agentSystem.crons.listTasks();
    const cronTaskIds = cronTasks.map((task) => task.id);
    const descriptor = this.descriptor;
    const cronTask = agentDescriptorIsCron(descriptor)
      ? cronTasks.find((task) => task.taskUid === descriptor.id) ?? null
      : null;
    const descriptorContext =
      descriptor.type === "user"
        ? {
            connector: descriptor.connector,
            channelId: descriptor.channelId,
            userId: descriptor.userId
          }
        : { connector: source };
    const pluginManager = this.agentSystem.pluginManager;
    logger.debug(`load: handleMessage loading plugin prompts agentId=${this.id}`);
    const pluginPrompts = await pluginManager.getSystemPrompts();
    const pluginPrompt = pluginPrompts.length > 0 ? pluginPrompts.join("\n\n") : "";
    const configSkillsRoot = path.join(this.agentSystem.config.current.configDir, "skills");
    const skills = new Skills({
      configRoot: configSkillsRoot,
      pluginManager
    });
    logger.debug(`load: handleMessage loading available skills agentId=${this.id}`);
    const availableSkills = await skills.list();
    const skillsPrompt = skillPromptFormat(availableSkills);
    const permanentAgents = await agentPermanentList(this.agentSystem.config.current);
    const permanentAgentsPrompt = agentPermanentPromptBuild(permanentAgents);
    const systemAgentPrompt =
      this.descriptor.type === "system"
        ? await systemAgentPromptResolve(this.descriptor.tag)
        : null;
    if (this.descriptor.type === "system" && !systemAgentPrompt) {
      throw new Error(`Unknown system agent tag: ${this.descriptor.tag}`);
    }
    const agentPrompt = this.descriptor.type === "permanent"
      ? this.descriptor.systemPrompt.trim()
      : (systemAgentPrompt?.systemPrompt ?? "");
    const agentKind = this.resolveAgentKind();
    const allowCronTools = agentDescriptorIsCron(this.descriptor);

    const defaultPermissions = this.agentSystem.config.current.defaultPermissions;
    if (agentDescriptorIsHeartbeat(this.descriptor)) {
      this.state.permissions = permissionMergeDefault(this.state.permissions, defaultPermissions);
      permissionEnsureDefaultFile(this.state.permissions, defaultPermissions);
    }
    const permissionTags = [...(entry.context.permissionTags ?? [])];
    if (permissionTags.length > 0) {
      try {
        permissionTagsApply(this.state.permissions, permissionTags);
      } catch (error) {
        logger.warn({ agentId: this.id, error }, "error: Failed to apply task permissions");
      }
    }

    logger.debug(`event: handleMessage ensuring prompt files agentId=${this.id}`);
    await agentPromptFilesEnsure();

    const providerSettings = providerId
      ? providers.find((provider) => provider.id === providerId)
      : providers[0];

    logger.debug(`event: handleMessage building system prompt agentId=${this.id}`);
    const systemPrompt = await this.buildSystemPrompt({
      provider: providerSettings?.id,
      model: providerSettings?.model,
      workspace: this.state.permissions.workingDir,
      writeDirs: this.state.permissions.writeDirs,
      network: this.state.permissions.network,
      events: this.state.permissions.events,
      connector: descriptorContext.connector,
      canSendFiles: fileSendModes.length > 0,
      fileSendModes: fileSendModes.length > 0 ? fileSendModes.join(", ") : "",
      messageFormatPrompt: connectorCapabilities?.messageFormatPrompt ?? "",
      channelId: descriptorContext.channelId,
      userId: descriptorContext.userId,
      cronTaskId: cronTask?.id,
      cronTaskName: cronTask?.name,
      cronMemoryPath: cronTask?.memoryPath,
      cronFilesPath: cronTask?.filesPath,
      cronTaskIds: cronTaskIds.length > 0 ? cronTaskIds.join(", ") : "",
      soulPath: DEFAULT_SOUL_PATH,
      userPath: DEFAULT_USER_PATH,
      agentsPath: DEFAULT_AGENTS_PATH,
      toolsPath: DEFAULT_TOOLS_PATH,
      memoryPath: DEFAULT_MEMORY_PATH,
      pluginPrompt,
      skillsPrompt,
      permanentAgentsPrompt,
      agentPrompt,
      replaceSystemPrompt: systemAgentPrompt?.replaceSystemPrompt ?? false,
      agentKind,
      parentAgentId: this.descriptor.type === "subagent"
        ? this.descriptor.parentAgentId ?? ""
        : "",
      configDir: this.agentSystem.config.current.configDir
    });

    try {
      const wrote = await agentSystemPromptWrite(this.agentSystem.config.current, this.id, systemPrompt);
      if (wrote) {
        logger.debug(`event: System prompt snapshot written agentId=${this.id}`);
      }
    } catch (error) {
      logger.warn({ agentId: this.id, error }, "error: Failed to write system prompt snapshot");
    }

    const history = await agentHistoryLoad(this.agentSystem.config.current, this.id);
    const contextTools = this.listContextTools(source, {
      agentKind,
      allowCronTools,
      skills: availableSkills
    });
    const compactionStatus = contextCompactionStatusBuild(
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
        const summaryText = summaryMessage
          ? messageExtractText(summaryMessage)?.trim() ?? ""
          : "";
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
          logger.warn({ agentId: this.id, error }, "error: Context compaction failed; continuing with full context");
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
      await agentHistoryAppend(this.agentSystem.config.current, this.id, pendingUserRecord);
    }

    const agentContext = this.state.context;
    const contextForRun: Context = {
      ...agentContext,
      tools: contextTools,
      systemPrompt
    };

    if (!contextForRun.messages) {
      contextForRun.messages = [];
    }

    logger.debug(`event: handleMessage building user message agentId=${this.id}`);
    const userMessage = await messageBuildUser(entry);
    contextForRun.messages.push(userMessage);

    const providersForAgent = providerId
      ? providers.filter((provider) => provider.id === providerId)
      : [];

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
          toolResolver: this.agentSystem.toolResolver,
          fileStore: this.agentSystem.fileStore,
          authStore: this.agentSystem.authStore,
          eventBus: this.agentSystem.eventBus,
          assistant: this.agentSystem.config.current.settings.assistant ?? null,
          agentSystem: this.agentSystem,
          heartbeats: this.agentSystem.heartbeats,
          skills,
          providersForAgent,
          verbose: this.agentSystem.config.current.verbose,
          logger,
          abortSignal: inferenceAbortController.signal,
          appendHistoryRecord: (record) =>
            agentHistoryAppend(this.agentSystem.config.current, this.id, record),
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
      await this.handleEmergencyReset(entry, source);
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
    await agentStateWrite(this.agentSystem.config.current, this.id, this.state);

    return result.responseText ?? null;
  }

  private async handleSystemMessage(
    item: AgentInboxSystemMessage
  ): Promise<string | null> {
    const text = messageBuildSystemText(item.text, item.origin);
    if (item.silent) {
      const receivedAt = Date.now();
      await agentHistoryAppend(this.agentSystem.config.current, this.id, {
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
      await agentStateWrite(this.agentSystem.config.current, this.id, this.state);
      return null;
    }

    const messageItem: AgentInboxMessage = {
      type: "message",
      message: { text },
      context: item.context ?? {}
    };
    return this.handleMessage(messageItem);
  }

  private async handleSignal(
    item: AgentInboxSignal
  ): Promise<{ delivered: boolean; responseText: string | null }> {
    const isInternalSignal = item.subscriptionPattern.startsWith("internal.");
    const subscription = isInternalSignal
      ? null
      : this.agentSystem.signals.subscriptionGet({
          agentId: this.id,
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
    const resetMessage = item.message?.trim() ?? "";
    if (resetMessage.length > 0) {
      this.state.context = {
        messages: [buildResetSystemMessage(resetMessage, now, this.id)]
      };
    } else {
      this.state.context = { messages: [] };
    }
    this.state.inferenceSessionId = createId();
    this.state.tokens = null;
    this.state.updatedAt = now;
    await agentHistoryAppend(this.agentSystem.config.current, this.id, {
      type: "reset",
      at: now,
      ...(resetMessage.length > 0 ? { message: resetMessage } : {})
    });
    await agentStateWrite(this.agentSystem.config.current, this.id, this.state);
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
    source: string
  ): Promise<void> {
    // Estimate token usage before resetting context
    const history = await agentHistoryLoad(this.agentSystem.config.current, this.id);
    const estimatedTokens = contextEstimateTokens(history);

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
    const history = await agentHistoryLoad(this.agentSystem.config.current, this.id);
    const historyMessages = await this.buildHistoryContext(history);
    this.state.context = {
      messages: agentRestoreContextResolve(
        this.state.context.messages ?? [],
        historyMessages
      )
    };
    this.state.updatedAt = Date.now();
    await agentStateWrite(this.agentSystem.config.current, this.id, this.state);
    this.agentSystem.eventBus.emit("agent.restored", { agentId: this.id });
    return true;
  }

  private async runManualCompaction(): Promise<{ ok: boolean; reason?: string }> {
    const messages = this.state.context.messages ?? [];
    if (messages.length === 0) {
      return { ok: false, reason: "empty" };
    }
    const providers = listActiveInferenceProviders(this.agentSystem.config.current.settings);
    if (providers.length === 0) {
      return { ok: false, reason: "no_provider" };
    }
    const providerId = this.resolveAgentProvider(providers);
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
      const summaryText = summaryMessage
        ? messageExtractText(summaryMessage)?.trim() ?? ""
        : "";
      if (!summaryText) {
        return { ok: false, reason: "empty_summary" };
      }
      const compactionAt = await this.applyCompactionSummary(summaryText);
      this.state.updatedAt = compactionAt;
      await agentStateWrite(this.agentSystem.config.current, this.id, this.state);
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
  private async completePendingToolCalls(
    reason: "session_crashed" | "user_aborted"
  ): Promise<void> {
    const records = await agentHistoryLoadAll(this.agentSystem.config.current, this.id);
    const completionRecords = agentHistoryPendingToolResultsBuild(records, reason, Date.now());
    if (completionRecords.length === 0) {
      return;
    }
    for (const record of completionRecords) {
      await agentHistoryAppend(this.agentSystem.config.current, this.id, record);
    }
    logger.warn(
      {
        agentId: this.id,
        reason,
        completedToolCalls: completionRecords.length
      },
      "event: Completed pending tool calls in history"
    );
  }

  /**
   * Notifies a parent agent when a subagent fails.
   * Expects: parent agent exists.
   */
  async notifySubagentFailure(reason: string, error?: unknown): Promise<void> {
    if (this.descriptor.type !== "subagent") {
      return;
    }
    const parentAgentId = this.descriptor.parentAgentId ?? null;
    if (!parentAgentId) {
      logger.warn({ agentId: this.id }, "event: Subagent missing parent agent");
      return;
    }
    const name = this.descriptor.name ?? "subagent";
    const errorText = error instanceof Error ? error.message : error ? String(error) : "";
    const detail = errorText ? `${reason} (${errorText})` : reason;
    try {
      await this.agentSystem.post(
        { agentId: parentAgentId },
        {
          type: "system_message",
          text: `Subagent ${name} (${this.id}) failed: ${detail}.`,
          origin: this.id
        }
      );
    } catch (sendError) {
      logger.warn(
        { agentId: this.id, parentAgentId, error: sendError },
        "error: Subagent failure notification failed"
      );
    }
  }

  /**
   * Resolves the cron task id for this agent when available.
   * Expects: cron task uid maps to a task on disk.
   */
  async resolveCronTaskId(): Promise<string | null> {
    const descriptor = this.descriptor;
    if (!agentDescriptorIsCron(descriptor)) {
      return null;
    }
    const tasks = await this.agentSystem.crons.listTasks();
    const task = tasks.find((entry) => entry.taskUid === descriptor.id) ?? null;
    return task?.id ?? null;
  }

  private listContextTools(
    source?: string,
    options?: {
      agentKind?: "background" | "foreground";
      allowCronTools?: boolean;
      skills?: AgentSkill[];
    }
  ) {
    return toolListContextBuild({
      tools: this.agentSystem.toolResolver.listTools(),
      skills: options?.skills,
      source,
      agentKind: options?.agentKind,
      allowCronTools: options?.allowCronTools,
      rlm: this.agentSystem.config.current.rlm,
      connectorRegistry: this.agentSystem.connectorRegistry,
      imageRegistry: this.agentSystem.imageRegistry
    });
  }

  private resolveAgentKind(): "background" | "foreground" {
    if (this.descriptor.type === "user") {
      return "foreground";
    }
    return "background";
  }

  private resolveAgentProvider(
    providers: ReturnType<typeof listActiveInferenceProviders>
  ): string | null {
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

  private async buildHistoryContext(
    records: AgentHistoryRecord[]
  ): Promise<Context["messages"]> {
    const messages: Context["messages"] = [];
    for (const record of records) {
      if (record.type === "reset" && record.message && record.message.trim().length > 0) {
        messages.push(buildResetSystemMessage(record.message, record.at, this.id));
      }
      if (record.type === "user_message") {
        const context: MessageContext = {};
        const message = messageFormatIncoming(
          {
            text: record.text,
            files: record.files.map((file) => ({ ...file }))
          },
          context,
          new Date(record.at)
        );
        const userEntry: AgentMessage = {
          id: createId(),
          message,
          context,
          receivedAt: record.at
        };
        messages.push(await messageBuildUser(userEntry));
      }
      if (record.type === "assistant_message") {
        const content: Array<{ type: "text"; text: string } | ToolCall> = [];
        if (record.text.length > 0) {
          content.push({ type: "text", text: record.text });
        }
        for (const toolCall of record.toolCalls) {
          content.push(toolCall);
        }
        messages.push({
          role: "assistant",
          content,
          api: "history",
          provider: "history",
          model: "history",
          usage: {
            input: 0,
            output: 0,
            cacheRead: 0,
            cacheWrite: 0,
            totalTokens: 0,
            cost: {
              input: 0,
              output: 0,
              cacheRead: 0,
              cacheWrite: 0,
              total: 0
            }
          },
          stopReason: "stop",
          timestamp: record.at
        });
      }
      if (record.type === "tool_result") {
        messages.push(record.output.toolMessage);
      }
    }
    return messages;
  }

  private async applyCompactionSummary(summaryText: string): Promise<number> {
    const summaryWithContinue = `${summaryText}\n\nPlease continue with the user's latest request.`;
    const compactionAt = Date.now();
    const resetMessage = "Session context compacted.";
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
    this.state.tokens = null;
    await agentHistoryAppend(this.agentSystem.config.current, this.id, {
      type: "reset",
      at: compactionAt,
      message: resetMessage
    });
    await agentHistoryAppend(this.agentSystem.config.current, this.id, {
      type: "user_message",
      at: compactionAt,
      text: summaryWithContinue,
      files: []
    });
    return compactionAt;
  }

  /**
   * Builds the system prompt text for the current agent.
   * Expects: prompt templates exist under engine/prompts.
   */
  private async buildSystemPrompt(
    context: AgentSystemPromptContext = {}
  ): Promise<string> {
    if (context.replaceSystemPrompt) {
      const replaced = (context.agentPrompt ?? "").trim();
      if (!replaced) {
        throw new Error("System prompt replacement requires a non-empty agent prompt.");
      }
      return replaced;
    }

    const soulPath = context.soulPath ?? DEFAULT_SOUL_PATH;
    const userPath = context.userPath ?? DEFAULT_USER_PATH;
    const agentsPath = context.agentsPath ?? DEFAULT_AGENTS_PATH;
    const toolsPath = context.toolsPath ?? DEFAULT_TOOLS_PATH;
    const memoryPath = context.memoryPath ?? DEFAULT_MEMORY_PATH;
    logger.debug(`event: buildSystemPrompt reading soul prompt path=${soulPath}`);
    const soul = await promptFileRead(soulPath, "SOUL.md");
    logger.debug(`event: buildSystemPrompt reading user prompt path=${userPath}`);
    const user = await promptFileRead(userPath, "USER.md");
    logger.debug(`event: buildSystemPrompt reading agents prompt path=${agentsPath}`);
    const agents = await promptFileRead(agentsPath, "AGENTS.md");
    logger.debug(`event: buildSystemPrompt reading tools prompt path=${toolsPath}`);
    const tools = await promptFileRead(toolsPath, "TOOLS.md");
    logger.debug(`event: buildSystemPrompt reading memory prompt path=${memoryPath}`);
    const memory = await promptFileRead(memoryPath, "MEMORY.md");
    logger.debug("event: buildSystemPrompt reading system template");
    const systemTemplate = await agentPromptBundledRead("SYSTEM.md");
    logger.debug("event: buildSystemPrompt reading permissions template");
    const permissionsTemplate = (await agentPromptBundledRead("PERMISSIONS.md")).trim();
    logger.debug("event: buildSystemPrompt reading agentic template");
    const agenticTemplate = (await agentPromptBundledRead("AGENTIC.md")).trim();
    const additionalWriteDirs = resolveAdditionalWriteDirs(
      context.writeDirs ?? [],
      context.workspace ?? "",
      soulPath,
      userPath,
      agentsPath,
      toolsPath,
      memoryPath
    );

    const isForeground = context.agentKind !== "background";
    const skillsPath =
      context.skillsPath ?? (context.configDir ? `${context.configDir}/skills` : "");

    // Build shared context for both permissions and main templates
    const templateContext = {
      date: new Date().toISOString().split("T")[0],
      os: `${os.type()} ${os.release()}`,
      arch: os.arch(),
      model: context.model ?? "unknown",
      provider: context.provider ?? "unknown",
      workspace: context.workspace ?? "unknown",
      network: context.network ?? false,
      events: context.events ?? false,
      connector: context.connector ?? "unknown",
      canSendFiles: context.canSendFiles ?? false,
      fileSendModes: context.fileSendModes ?? "",
      messageFormatPrompt: context.messageFormatPrompt ?? "",
      channelId: context.channelId ?? "unknown",
      userId: context.userId ?? "unknown",
      cronTaskId: context.cronTaskId ?? "",
      cronTaskName: context.cronTaskName ?? "",
      cronMemoryPath: context.cronMemoryPath ?? "",
      cronFilesPath: context.cronFilesPath ?? "",
      cronTaskIds: context.cronTaskIds ?? "",
      soulPath,
      userPath,
      agentsPath,
      toolsPath,
      memoryPath,
      pluginPrompt: context.pluginPrompt ?? "",
      skillsPrompt: context.skillsPrompt ?? "",
      parentAgentId: context.parentAgentId ?? "",
      configDir: context.configDir ?? "",
      skillsPath,
      isForeground,
      soul,
      user,
      agents,
      tools,
      memory,
      additionalWriteDirs,
      permanentAgentsPrompt: context.permanentAgentsPrompt ?? "",
      agentPrompt: context.agentPrompt ?? ""
    };

    // Render permissions template first (it contains Handlebars expressions)
    logger.debug("event: buildSystemPrompt compiling permissions template");
    const permissions = Handlebars.compile(permissionsTemplate)(templateContext);

    logger.debug("event: buildSystemPrompt compiling agentic template");
    const agentic = Handlebars.compile(agenticTemplate)(templateContext);

    logger.debug("event: buildSystemPrompt compiling main template");
    const template = Handlebars.compile(systemTemplate);
    logger.debug("event: buildSystemPrompt rendering template");
    const rendered = template({
      ...templateContext,
      permissions,
      agentic
    });

    return rendered.trim();
  }
}

function isChannelSignalType(type: string): boolean {
  return type.startsWith("channel.") && type.endsWith(":message");
}

type AgentSystemPromptContext = {
  model?: string;
  provider?: string;
  workspace?: string;
  writeDirs?: string[];
  network?: boolean;
  events?: boolean;
  connector?: string;
  canSendFiles?: boolean;
  fileSendModes?: string;
  messageFormatPrompt?: string;
  channelId?: string;
  userId?: string;
  cronTaskId?: string;
  cronTaskName?: string;
  cronMemoryPath?: string;
  cronFilesPath?: string;
  cronTaskIds?: string;
  soulPath?: string;
  userPath?: string;
  agentsPath?: string;
  toolsPath?: string;
  memoryPath?: string;
  pluginPrompt?: string;
  skillsPrompt?: string;
  permanentAgentsPrompt?: string;
  agentPrompt?: string;
  replaceSystemPrompt?: boolean;
  agentKind?: "background" | "foreground";
  parentAgentId?: string;
  configDir?: string;
  skillsPath?: string;
};

function resolveAdditionalWriteDirs(
  writeDirs: string[],
  workspace: string,
  soulPath: string,
  userPath: string,
  agentsPath: string,
  toolsPath: string,
  memoryPath: string
): string[] {
  const excluded = new Set(
    [workspace, soulPath, userPath, agentsPath, toolsPath, memoryPath]
      .filter((entry) => entry && entry.trim().length > 0)
      .map((entry) => path.resolve(entry))
  );
  const filtered = writeDirs
    .filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0)
    .map((entry) => path.resolve(entry))
    .filter((entry) => !excluded.has(entry));
  return Array.from(new Set(filtered)).sort();
}

async function promptFileRead(filePath: string, fallbackPrompt: string): Promise<string> {
  const resolvedPath = path.resolve(filePath);
  try {
    const content = await fs.readFile(resolvedPath, "utf8");
    const trimmed = content.trim();
    if (trimmed.length > 0) {
      return trimmed;
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
  }

  const defaultContent = await agentPromptBundledRead(fallbackPrompt);
  return defaultContent.trim();
}

function toFileReferences(files: Array<{ id: string; name: string; path: string; mimeType: string; size: number }>): Array<{ id: string; name: string; path: string; mimeType: string; size: number }> {
  return files.map((file) => ({
    id: file.id,
    name: file.name,
    path: file.path,
    mimeType: file.mimeType,
    size: file.size
  }));
}

function buildResetSystemMessage(
  text: string,
  at: number,
  origin: string
): Context["messages"][number] {
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
