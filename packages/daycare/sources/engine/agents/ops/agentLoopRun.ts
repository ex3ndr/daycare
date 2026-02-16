import type { Context } from "@mariozechner/pi-ai";
import type { Logger } from "pino";

import type { FileStore } from "../../../files/store.js";
import type { AgentSkill, FileReference } from "@/types";
import type { AuthStore } from "../../../auth/store.js";
import type { AssistantSettings, ProviderSettings } from "../../../settings.js";
import type { Connector } from "@/types";
import type { ConnectorRegistry } from "../../modules/connectorRegistry.js";
import type { ToolResolverApi } from "../../modules/toolResolver.js";
import type { InferenceRouter } from "../../modules/inference/router.js";
import { messageExtractText } from "../../messages/messageExtractText.js";
import { messageExtractToolCalls } from "../../messages/messageExtractToolCalls.js";
import { messageNoMessageIs } from "../../messages/messageNoMessageIs.js";
import { toolArgsFormatVerbose } from "../../modules/tools/toolArgsFormatVerbose.js";
import { toolResultFormatVerbose } from "../../modules/tools/toolResultFormatVerbose.js";
import { toolListContextBuild } from "../../modules/tools/toolListContextBuild.js";
import type { EngineEventBus } from "../../ipc/events.js";
import type { Agent } from "../agent.js";
import type { AgentHistoryRecord, AgentMessage } from "./agentTypes.js";
import { agentDescriptorIsCron } from "./agentDescriptorIsCron.js";
import { agentDescriptorTargetResolve } from "./agentDescriptorTargetResolve.js";
import type { AgentSystem } from "../agentSystem.js";
import type { Heartbeats } from "../../heartbeat/heartbeats.js";
import { tokensResolve } from "./tokensResolve.js";
import type { Skills } from "../../skills/skills.js";
import { agentHistoryPendingToolResultsBuild } from "./agentHistoryPendingToolResultsBuild.js";
import { tagExtract } from "../../../util/tagExtract.js";

const MAX_TOOL_ITERATIONS = 500; // Make this big enough to handle complex tasks

type AgentLoopRunOptions = {
  entry: AgentMessage;
  agent: Agent;
  source: string;
  context: Context;
  connector: Connector | null;
  connectorRegistry: ConnectorRegistry;
  inferenceRouter: InferenceRouter;
  toolResolver: ToolResolverApi;
  fileStore: FileStore;
  authStore: AuthStore;
  eventBus: EngineEventBus;
  assistant: AssistantSettings | null;
  agentSystem: AgentSystem;
  heartbeats: Heartbeats;
  skills: Skills;
  providersForAgent: ProviderSettings[];
  verbose: boolean;
  logger: Logger;
  abortSignal?: AbortSignal;
  appendHistoryRecord?: (record: AgentHistoryRecord) => Promise<void>;
  notifySubagentFailure: (reason: string, error?: unknown) => Promise<void>;
};

type AgentLoopResult = {
  responseText?: string | null;
  historyRecords: AgentHistoryRecord[];
  contextOverflow?: boolean;
  tokenStatsUpdates: Array<{
    provider: string;
    model: string;
    size: {
      input: number;
      output: number;
      cacheRead: number;
      cacheWrite: number;
      total: number;
    };
  }>;
};

/**
 * Runs the agent inference loop and handles tool execution + response delivery.
 * Expects: context already includes the user message and system prompt.
 */
export async function agentLoopRun(options: AgentLoopRunOptions): Promise<AgentLoopResult> {
  const {
    entry,
    agent,
    source,
    context,
    connector,
    connectorRegistry,
    inferenceRouter,
    toolResolver,
    fileStore,
    authStore,
    eventBus,
    assistant,
    agentSystem,
    heartbeats,
    skills,
    providersForAgent,
    verbose,
    logger,
    abortSignal,
    appendHistoryRecord,
    notifySubagentFailure
  } = options;

  let response: Awaited<ReturnType<InferenceRouter["complete"]>> | null = null;
  let toolLoopExceeded = false;
  let lastResponseHadToolCalls = false;
  const generatedFiles: FileReference[] = [];
  let lastResponseTextSent = false;
  let finalResponseText: string | null = null;
  let lastResponseNoMessage = false;
  const historyRecords: AgentHistoryRecord[] = [];
  const tokenStatsUpdates: AgentLoopResult["tokenStatsUpdates"] = [];
  let activeSkills: AgentSkill[] = [];
  const isChildAgent = agent.descriptor.type === "subagent" || agent.descriptor.type === "app";
  let childAgentNudged = false;
  let childAgentResponded = false;
  const agentKind = agent.descriptor.type === "user" ? "foreground" : "background";
  const allowCronTools = agentDescriptorIsCron(agent.descriptor);
  const target = agentDescriptorTargetResolve(agent.descriptor);
  const targetId = target?.targetId ?? null;
  logger.debug(`start: Starting typing indicator targetId=${targetId ?? "none"}`);
  const stopTyping = targetId ? connector?.startTyping?.(targetId) : null;

  try {
    logger.debug(`start: Starting inference loop maxIterations=${MAX_TOOL_ITERATIONS}`);
    for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration += 1) {
      try {
        activeSkills = await skills.list();
        context.tools = toolListContextBuild({
          tools: toolResolver.listTools(),
          skills: activeSkills,
          source,
          agentKind,
          allowCronTools,
          rlm: agentSystem.config.current.features.rlm,
          connectorRegistry,
          imageRegistry: agentSystem.imageRegistry
        });
        logger.debug(
          `load: Read skills before inference call iteration=${iteration} count=${activeSkills.length}`
        );
      } catch (error) {
        logger.warn(
          { agentId: agent.id, error },
          "error: Failed to read skills before inference call; continuing with previous snapshot"
        );
      }
      logger.debug(
        `event: Inference loop iteration=${iteration} agentId=${agent.id} messageCount=${context.messages.length}`
      );
      response = await inferenceRouter.complete(
        context,
        agent.state.inferenceSessionId ?? agent.id,
        {
          providersOverride: providersForAgent,
          signal: abortSignal,
          onAttempt: (providerId, modelId) => {
            logger.debug(
              `start: Inference attempt starting providerId=${providerId} modelId=${modelId} agentId=${agent.id}`
            );
            logger.info(
              { agentId: agent.id, messageId: entry.id, provider: providerId, model: modelId },
              "start: Inference started"
            );
          },
          onFallback: (providerId, error) => {
            logger.debug(
              `event: Inference falling back to next provider providerId=${providerId} error=${String(error)}`
            );
            logger.warn(
              { agentId: agent.id, messageId: entry.id, provider: providerId, error },
              "event: Inference fallback"
            );
          },
          onSuccess: (providerId, modelId, message) => {
            logger.debug(
              `event: Inference succeeded providerId=${providerId} modelId=${modelId} stopReason=${message.stopReason} inputTokens=${message.usage?.input} outputTokens=${message.usage?.output}`
            );
            logger.info(
              {
                agentId: agent.id,
                messageId: entry.id,
                provider: providerId,
                model: modelId,
                stopReason: message.stopReason,
                usage: message.usage
              },
              "event: Inference completed"
            );
          },
          onFailure: (providerId, error) => {
            logger.debug(
              `error: Inference failed completely providerId=${providerId} error=${String(error)}`
            );
            logger.warn(
              { agentId: agent.id, messageId: entry.id, provider: providerId, error },
              "error: Inference failed"
            );
          }
        }
      );

      const tokenUsage = tokensResolve(context, response.message);
      const tokensEntry =
        tokenUsage.size.input === 0 &&
        tokenUsage.size.output === 0 &&
        tokenUsage.size.cacheRead === 0 &&
        tokenUsage.size.cacheWrite === 0 &&
        tokenUsage.source === "estimate"
          ? null
          : {
              provider: response.providerId,
              model: response.modelId,
              size: tokenUsage.size
            };
      if (tokenUsage.source === "usage" && tokensEntry) {
        tokenStatsUpdates.push({
          provider: tokensEntry.provider,
          model: tokensEntry.model,
          size: {
            input: tokensEntry.size.input,
            output: tokensEntry.size.output,
            cacheRead: tokensEntry.size.cacheRead,
            cacheWrite: tokensEntry.size.cacheWrite,
            total: tokensEntry.size.total
          }
        });
      }

      logger.debug(
        `receive: Inference response received providerId=${response.providerId} modelId=${response.modelId} stopReason=${response.message.stopReason}`
      );
      context.messages.push(response.message);

      const responseText = messageExtractText(response.message);
      const toolCalls = messageExtractToolCalls(response.message);
      lastResponseHadToolCalls = toolCalls.length > 0;
      const suppressUserOutput = messageNoMessageIs(responseText);
      if (suppressUserOutput) {
        stripNoMessageTextBlocks(response.message);
        logger.debug("event: NO_MESSAGE detected; suppressing user output for this response");
      }
      lastResponseNoMessage = suppressUserOutput;
      const effectiveResponseText = suppressUserOutput ? null : responseText;
      const trimmedText = effectiveResponseText?.trim() ?? "";
      const hasResponseText = trimmedText.length > 0;
      finalResponseText = hasResponseText ? effectiveResponseText : null;
      lastResponseTextSent = false;
      if (hasResponseText && connector && targetId) {
        try {
          await connector.sendMessage(targetId, {
            text: effectiveResponseText,
            replyToMessageId: entry.context.messageId
          });
          eventBus.emit("agent.outgoing", {
            agentId: agent.id,
            source,
            message: { text: effectiveResponseText },
            context: entry.context
          });
          lastResponseTextSent = true;
        } catch (error) {
          logger.warn({ connector: source, error }, "error: Failed to send response text");
        }
      }

      logger.debug(`event: Extracted tool calls from response toolCallCount=${toolCalls.length}`);
      await historyRecordAppend(historyRecords, {
        type: "assistant_message",
        at: Date.now(),
        text: effectiveResponseText ?? "",
        files: [],
        toolCalls,
        tokens: tokensEntry
      }, appendHistoryRecord);

      // Child-agent <response> tag: check on every iteration, deliver each one to parent
      if (isChildAgent) {
        const extracted = tagExtract(responseText ?? "", "response");
        if (extracted !== null) {
          finalResponseText = extracted;
          childAgentResponded = true;
          await subagentDeliverResponse(agentSystem, agent, extracted, logger);
        }
      }

      if (toolCalls.length === 0) {
        // Child-agent final iteration: nudge if no <response> tag was ever emitted
        if (isChildAgent && !childAgentResponded) {
          if (!childAgentNudged) {
            childAgentNudged = true;
            context.messages.push({
              role: "user",
              content: [
                {
                  type: "text",
                  text: "You must wrap your final answer in <response>...</response> tags. Emit your response now."
                }
              ],
              timestamp: Date.now()
            });
            logger.debug("event: Child agent nudged to emit <response> tag");
            continue;
          } else {
            finalResponseText = "Error: child agent did not produce a response.";
            logger.warn(
              { agentId: agent.id },
              "error: Child agent failed to emit <response> tag after nudge"
            );
            break;
          }
        }
        logger.debug(`event: No tool calls, breaking inference loop iteration=${iteration}`);
        break;
      }

      for (const toolCall of toolCalls) {
        const argsPreview = JSON.stringify(toolCall.arguments).slice(0, 200);
        logger.debug(
          `execute: Executing tool call toolName=${toolCall.name} toolCallId=${toolCall.id} args=${argsPreview}`
        );

        if (verbose && !suppressUserOutput && connector && targetId) {
          const argsFormatted = toolArgsFormatVerbose(toolCall.arguments);
          await connector.sendMessage(targetId, {
            text: `[tool] ${toolCall.name}(${argsFormatted})`
          });
        }

        const toolResult = await toolResolver.execute(toolCall, {
          connectorRegistry,
          fileStore,
          auth: authStore,
          logger,
          assistant,
          permissions: agent.state.permissions,
          agent,
          source,
          messageContext: entry.context,
          agentSystem,
          heartbeats,
          toolResolver,
          skills: activeSkills,
          permissionRequestRegistry: agentSystem.permissionRequestRegistry
        });
        logger.debug(
          `event: Tool execution completed toolName=${toolCall.name} isError=${toolResult.toolMessage.isError} fileCount=${toolResult.files.length}`
        );

        if (verbose && !suppressUserOutput && connector && targetId) {
          const resultText = toolResultFormatVerbose(toolResult);
          await connector.sendMessage(targetId, {
            text: resultText
          });
        }

        context.messages.push(toolResult.toolMessage);
        await historyRecordAppend(historyRecords, {
          type: "tool_result",
          at: Date.now(),
          toolCallId: toolCall.id,
          output: toolResult
        }, appendHistoryRecord);
        if (toolResult.files.length > 0) {
          generatedFiles.push(...toolResult.files);
          logger.debug(`event: Tool generated files count=${toolResult.files.length}`);
        }
      }

      if (iteration === MAX_TOOL_ITERATIONS - 1) {
        logger.debug(`event: Tool loop limit reached iteration=${iteration}`);
        toolLoopExceeded = true;
      }
    }
    logger.debug("event: Inference loop completed");
  } catch (error) {
    logger.debug(`error: Inference loop caught error error=${String(error)}`);
    if (isInferenceAbortError(error, abortSignal)) {
      await historyPendingToolCallsComplete(
        historyRecords,
        "user_aborted",
        appendHistoryRecord
      );
      logger.info({ agentId: agent.id }, "event: Inference aborted");
      return { responseText: finalResponseText, historyRecords, tokenStatsUpdates };
    }
    if (isContextOverflowError(error)) {
      logger.warn({ agentId: agent.id, error }, "event: Inference context overflow detected");
      return { responseText: finalResponseText, historyRecords, contextOverflow: true, tokenStatsUpdates };
    }
    await historyPendingToolCallsComplete(
      historyRecords,
      "session_crashed",
      appendHistoryRecord
    );
    logger.warn({ connector: source, error }, "error: Inference failed");
    const message =
      error instanceof Error && error.message === "No inference provider available"
        ? "No inference provider available."
        : "Inference failed.";
    logger.debug(`error: Sending error message to user message=${message}`);
    await notifySubagentFailure("Inference failed", error);
    if (connector && targetId) {
      await connector.sendMessage(targetId, {
        text: message,
        replyToMessageId: entry.context.messageId
      });
    }
    logger.debug("error: handleMessage completed with error");
    return { responseText: finalResponseText, historyRecords, tokenStatsUpdates };
  } finally {
    logger.debug("stop: Stopping typing indicator");
    stopTyping?.();
  }

  if (!response) {
    logger.debug("receive: No response received, returning without completion");
    return { responseText: finalResponseText, historyRecords, tokenStatsUpdates };
  }

  if (response.message.stopReason === "aborted") {
    await historyPendingToolCallsComplete(
      historyRecords,
      "user_aborted",
      appendHistoryRecord
    );
    logger.info({ agentId: agent.id }, "event: Inference aborted by provider");
    return { responseText: finalResponseText, historyRecords, tokenStatsUpdates };
  }

  if (response.message.stopReason === "error") {
    if (isContextOverflowError(response.message.errorMessage ?? "")) {
      logger.warn(
        { agentId: agent.id, error: response.message.errorMessage },
        "event: Inference context overflow detected"
      );
      return { responseText: finalResponseText, historyRecords, contextOverflow: true, tokenStatsUpdates };
    }
    const message = "Inference failed.";
    const errorDetail =
      response.message.errorMessage && response.message.errorMessage.length > 0
        ? response.message.errorMessage
        : "unknown";
    logger.warn(
      `error: Inference returned error response provider=${response.providerId} model=${response.modelId} stopReason=${response.message.stopReason} error=${errorDetail}`
    );
    await notifySubagentFailure("Inference failed", response.message.errorMessage);
    try {
      if (connector && targetId) {
        await connector.sendMessage(targetId, {
          text: message,
          replyToMessageId: entry.context.messageId
        });
        eventBus.emit("agent.outgoing", {
          agentId: agent.id,
          source,
          message: { text: message },
          context: entry.context
        });
      }
    } catch (error) {
      logger.warn({ connector: source, error }, "error: Failed to send error response");
    }
    logger.debug("error: handleMessage completed with error stop reason");
    return { responseText: finalResponseText, historyRecords, tokenStatsUpdates };
  }

  const responseText = messageExtractText(response.message);
  const hasResponseText = !!responseText && responseText.trim().length > 0;
  logger.debug(
    `event: Extracted assistant text hasText=${hasResponseText} textLength=${responseText?.length ?? 0} generatedFileCount=${generatedFiles.length}`
  );

  if (!hasResponseText && generatedFiles.length === 0) {
    if (toolLoopExceeded && lastResponseHadToolCalls) {
      const message = "Tool execution limit reached.";
      logger.debug("error: Tool loop exceeded, sending error message");
      await notifySubagentFailure(message);
      try {
        if (connector && targetId && !lastResponseNoMessage) {
          await connector.sendMessage(targetId, {
            text: message,
            replyToMessageId: entry.context.messageId
          });
        }
      } catch (error) {
        logger.warn({ connector: source, error }, "error: Failed to send tool error");
      }
    }
    logger.debug("event: handleMessage completed with no response text");
    return { responseText: finalResponseText, historyRecords, tokenStatsUpdates };
  }

  if (lastResponseNoMessage) {
    logger.debug("event: NO_MESSAGE suppressed final response delivery");
    return { responseText: finalResponseText, historyRecords, tokenStatsUpdates };
  }

  const shouldSendText = hasResponseText && !lastResponseTextSent && !lastResponseNoMessage;
  const shouldSendFiles = generatedFiles.length > 0 && !lastResponseNoMessage;
  const outgoingText = shouldSendText ? responseText : null;
  logger.debug(
    `send: Sending response to user textLength=${outgoingText?.length ?? 0} fileCount=${generatedFiles.length} targetId=${targetId ?? "none"}`
  );
  try {
    if (connector && targetId && (outgoingText || shouldSendFiles)) {
      await connector.sendMessage(targetId, {
        text: outgoingText,
        files: shouldSendFiles ? generatedFiles : undefined,
        replyToMessageId: entry.context.messageId
      });
      logger.debug("send: Response sent successfully");
      eventBus.emit("agent.outgoing", {
        agentId: agent.id,
        source,
        message: {
          text: outgoingText,
          files: shouldSendFiles ? generatedFiles : undefined
        },
        context: entry.context
      });
      logger.debug("event: Agent outgoing event emitted");
    }
  } catch (error) {
    logger.debug(`error: Failed to send response error=${String(error)}`);
    logger.warn({ connector: source, error }, "error: Failed to send response");
  }
  logger.debug("event: handleMessage completed successfully");
  return { responseText: finalResponseText, historyRecords, tokenStatsUpdates };
}

async function historyPendingToolCallsComplete(
  historyRecords: AgentHistoryRecord[],
  reason: "session_crashed" | "user_aborted",
  appendHistoryRecord?: (record: AgentHistoryRecord) => Promise<void>
): Promise<void> {
  const completionRecords = agentHistoryPendingToolResultsBuild(
    historyRecords,
    reason,
    Date.now()
  );
  for (const record of completionRecords) {
    await historyRecordAppend(historyRecords, record, appendHistoryRecord);
  }
}

/**
 * Delivers a <response> tag payload from a child background agent to its parent agent.
 * Called inline during the inference loop so intermediate responses arrive immediately.
 */
async function subagentDeliverResponse(
  agentSystem: AgentSystem,
  agent: Agent,
  text: string,
  logger: Logger
): Promise<void> {
  if (agent.descriptor.type !== "subagent" && agent.descriptor.type !== "app") {
    return;
  }
  const parentAgentId = agent.descriptor.parentAgentId ?? null;
  if (!parentAgentId) {
    return;
  }
  try {
    await agentSystem.post(
      { agentId: parentAgentId },
      { type: "system_message", text, origin: agent.id }
    );
    logger.debug("event: Child agent <response> delivered to parent");
  } catch (error) {
    logger.warn(
      { agentId: agent.id, parentAgentId, error },
      "error: Child agent response delivery failed"
    );
  }
}

async function historyRecordAppend(
  historyRecords: AgentHistoryRecord[],
  record: AgentHistoryRecord,
  appendHistoryRecord?: (record: AgentHistoryRecord) => Promise<void>
): Promise<void> {
  historyRecords.push(record);
  await appendHistoryRecord?.(record);
}

// Remove NO_MESSAGE text blocks so the sentinel never re-enters future model context.
function stripNoMessageTextBlocks(message: Context["messages"][number]): void {
  if (message.role !== "assistant" || !Array.isArray(message.content)) {
    return;
  }
  const nextContent = message.content.filter((block) => block.type !== "text");
  if (nextContent.length !== message.content.length) {
    message.content = nextContent;
  }
}

function isContextOverflowError(error: unknown): boolean {
  const candidates = new Set<string>();

  const add = (value: unknown) => {
    if (typeof value === "string" && value.trim().length > 0) {
      candidates.add(value);
    }
  };

  if (error instanceof Error) {
    add(error.message);
    add((error as { code?: unknown }).code);
    add((error as { type?: unknown }).type);
    add((error as { name?: unknown }).name);
    add((error as { status?: unknown }).status);
    add((error as { statusCode?: unknown }).statusCode);
    add((error as { error?: unknown }).error);
    add((error as { reason?: unknown }).reason);
    add((error as { details?: unknown }).details);
    add((error as { cause?: unknown }).cause);
  } else if (typeof error === "object" && error !== null) {
    const record = error as Record<string, unknown>;
    add(record.message);
    add(record.code);
    add(record.type);
    add(record.name);
    add(record.status);
    add(record.statusCode);
    add(record.error);
    add(record.reason);
    add(record.details);
    add(record.cause);
  } else {
    add(error);
  }

  const patterns = [
    "context_length_exceeded",
    "context length exceeded",
    "maximum context length",
    "max context length",
    "context window",
    "context limit",
    "context too long",
    "prompt too long",
    "prompt is too long",
    "input too long",
    "input is too long",
    "input token limit",
    "maximum number of tokens",
    "max tokens",
    "exceeds the maximum context",
    "exceeds context",
    "token limit exceeded",
    "too many tokens"
  ];

  for (const value of candidates) {
    const normalized = value.toLowerCase();
    if (patterns.some((pattern) => normalized.includes(pattern))) {
      return true;
    }
  }
  return false;
}

function isInferenceAbortError(error: unknown, signal?: AbortSignal): boolean {
  if (signal?.aborted) {
    return true;
  }
  if (error instanceof Error && error.name === "AbortError") {
    return true;
  }
  if (typeof error === "object" && error !== null) {
    const name = (error as { name?: unknown }).name;
    if (typeof name === "string" && name === "AbortError") {
      return true;
    }
  }
  return false;
}
