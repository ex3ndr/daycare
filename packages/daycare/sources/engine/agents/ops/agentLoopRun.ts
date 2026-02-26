import type { Context as InferenceContext } from "@mariozechner/pi-ai";
import { createId } from "@paralleldrive/cuid2";
import type { Logger } from "pino";
import type { AgentSkill, Connector, ToolExecutionContext } from "@/types";
import type { AuthStore } from "../../../auth/store.js";
import type { AssistantSettings, ProviderSettings } from "../../../settings.js";
import { tagExtractAll } from "../../../util/tagExtract.js";
import type { Heartbeats } from "../../heartbeat/heartbeats.js";
import type { EngineEventBus } from "../../ipc/events.js";
import type { Memory } from "../../memory/memory.js";
import { messageExtractText } from "../../messages/messageExtractText.js";
import { messageNoMessageIs } from "../../messages/messageNoMessageIs.js";
import type { ConnectorRegistry } from "../../modules/connectorRegistry.js";
import type { InferenceRouter } from "../../modules/inference/router.js";
import { montyPreambleBuild } from "../../modules/monty/montyPreambleBuild.js";
import { RLM_TOOL_NAME, SKIP_TOOL_NAME } from "../../modules/rlm/rlmConstants.js";
import { rlmHistoryCompleteErrorRecordBuild } from "../../modules/rlm/rlmHistoryCompleteErrorRecordBuild.js";
import { RLM_LIMITS } from "../../modules/rlm/rlmLimits.js";
import { rlmNoToolsExtract } from "../../modules/rlm/rlmNoToolsExtract.js";
import { rlmNoToolsResultMessageBuild } from "../../modules/rlm/rlmNoToolsResultMessageBuild.js";
import {
    rlmPrintCaptureAppend,
    rlmPrintCaptureCreate,
    rlmPrintCaptureFlushTrailing
} from "../../modules/rlm/rlmPrintCapture.js";
import { rlmSnapshotEncode } from "../../modules/rlm/rlmSnapshotEncode.js";
import { rlmStepResume } from "../../modules/rlm/rlmStepResume.js";
import { rlmStepStart } from "../../modules/rlm/rlmStepStart.js";
import { rlmStepToolCall } from "../../modules/rlm/rlmStepToolCall.js";
import { rlmToolsForContextResolve } from "../../modules/rlm/rlmToolsForContextResolve.js";
import { rlmValueFormat } from "../../modules/rlm/rlmValueFormat.js";
import { rlmVmSnapshotIs } from "../../modules/rlm/rlmVmProgress.js";
import { rlmWorkerKeyResolve } from "../../modules/rlm/rlmWorkerKeyResolve.js";
import { sayFileExtract } from "../../modules/say/sayFileExtract.js";
import { sayFileResolve } from "../../modules/say/sayFileResolve.js";
import type { ToolResolverApi } from "../../modules/toolResolver.js";
import type { Skills } from "../../skills/skills.js";
import type { Agent } from "../agent.js";
import type { AgentSystem } from "../agentSystem.js";
import { agentDescriptorTargetResolve } from "./agentDescriptorTargetResolve.js";
import { agentInferencePromptWrite } from "./agentInferencePromptWrite.js";
import type { AgentLoopPendingPhase } from "./agentLoopPendingPhaseResolve.js";
import type { AgentLoopPhase } from "./agentLoopStepTypes.js";
import { agentMessageRunPythonFailureTrim } from "./agentMessageRunPythonFailureTrim.js";
import { agentMessageRunPythonSayAfterTrim } from "./agentMessageRunPythonSayAfterTrim.js";
import { agentMessageRunPythonTerminalTrim } from "./agentMessageRunPythonTerminalTrim.js";
import { agentToolExecutionAllowlistResolve } from "./agentToolExecutionAllowlistResolve.js";
import type { AgentHistoryRecord, AgentMessage } from "./agentTypes.js";
import { inferenceErrorAnthropicPromptOverflowIs } from "./inferenceErrorAnthropicPromptOverflowIs.js";
import { inferenceErrorAnthropicPromptOverflowTokensExtract } from "./inferenceErrorAnthropicPromptOverflowTokensExtract.js";
import { tokensResolve } from "./tokensResolve.js";

const MAX_TOOL_ITERATIONS = 500; // Make this big enough to handle complex tasks

type AgentLoopRunOptions = {
    entry: AgentMessage;
    agent: Agent;
    source: string;
    context: InferenceContext;
    connector: Connector | null;
    connectorRegistry: ConnectorRegistry;
    inferenceRouter: InferenceRouter;
    toolResolver: ToolResolverApi;
    authStore: AuthStore;
    eventBus: EngineEventBus;
    assistant: AssistantSettings | null;
    agentSystem: AgentSystem;
    heartbeats: Heartbeats;
    memory: Memory;
    skills: Skills;
    skillsActiveRoot?: string;
    skillsPersonalRoot?: string;
    providersForAgent: ProviderSettings[];
    logger: Logger;
    abortSignal?: AbortSignal;
    appendHistoryRecord?: (record: AgentHistoryRecord) => Promise<void>;
    notifySubagentFailure: (reason: string, error?: unknown) => Promise<void>;
    initialPhase?: AgentLoopPendingPhase;
    stopAfterPendingPhase?: boolean;
};

type AgentLoopResult = {
    responseText?: string | null;
    historyRecords: AgentHistoryRecord[];
    contextOverflow?: boolean;
    contextOverflowTokens?: number;
    tokenStatsUpdates: Array<{
        at: number;
        provider: string;
        model: string;
        size: {
            input: number;
            output: number;
            cacheRead: number;
            cacheWrite: number;
            total: number;
        };
        cost: number;
    }>;
};

type AgentLoopBlockState = Extract<AgentLoopPhase, { type: "vm_start" }>["blockState"];

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
        authStore,
        eventBus,
        assistant,
        agentSystem,
        heartbeats,
        memory,
        skills,
        providersForAgent,
        logger,
        abortSignal,
        appendHistoryRecord,
        notifySubagentFailure,
        initialPhase,
        stopAfterPendingPhase
    } = options;

    let response: Awaited<ReturnType<InferenceRouter["complete"]>> | null = null;
    let toolLoopExceeded = false;
    let lastResponseTextSent = false;
    let finalResponseText: string | null = null;
    let lastResponseNoMessage = false;
    const historyRecords: AgentHistoryRecord[] = [];
    const tokenStatsUpdates: AgentLoopResult["tokenStatsUpdates"] = [];
    let activeSkills: AgentSkill[] = [];
    const isChildAgent =
        agent.descriptor.type === "subagent" ||
        agent.descriptor.type === "app" ||
        agent.descriptor.type === "memory-search";
    let childAgentNudged = false;
    let childAgentMessageSent = false;
    const agentKind =
        agent.descriptor.type === "user" || agent.descriptor.type === "subuser" ? "foreground" : "background";
    const target = agentDescriptorTargetResolve(agent.descriptor);
    const targetId = target?.targetId ?? null;
    const toolVisibilityContext = {
        ctx: agent.ctx,
        descriptor: agent.descriptor
    };
    const allowedToolNames = agentToolExecutionAllowlistResolve(agent.descriptor);
    const restoreOnly = Boolean(initialPhase && stopAfterPendingPhase);
    logger.debug(`start: Starting typing indicator targetId=${targetId ?? "none"}`);
    const stopTyping = targetId ? connector?.startTyping?.(targetId) : null;

    const blockStateBuild = (params: {
        iteration: number;
        blocks: string[];
        blockIndex: number;
        preamble: string;
        toolCallId: string;
        assistantRecordAt: number;
        historyResponseText: string;
    }): AgentLoopBlockState => {
        const executionContext: ToolExecutionContext = {
            connectorRegistry,
            sandbox: agent.sandbox,
            auth: authStore,
            logger,
            assistant,
            agent,
            ctx: agent.ctx,
            source,
            messageContext: entry.context,
            agentSystem,
            heartbeats,
            memory,
            toolResolver,
            skills: activeSkills,
            skillsPersonalRoot: options.skillsPersonalRoot,
            appendHistoryRecord,
            allowedToolNames,
            abortSignal
        };
        const trackingToolResolver: ToolResolverApi = {
            listTools: () => toolResolver.listTools(),
            listToolsForAgent: (resolverContext) => toolResolver.listToolsForAgent(resolverContext),
            execute: async (toolCall, toolContext) => {
                if (isChildAgent && !childAgentMessageSent && toolCall.name === "send_agent_message") {
                    const args = toolCall.arguments as { agentId?: string; text?: string };
                    const parentId =
                        "parentAgentId" in agent.descriptor
                            ? (agent.descriptor as { parentAgentId?: string }).parentAgentId
                            : undefined;
                    if (!args.agentId || args.agentId === parentId) {
                        childAgentMessageSent = true;
                        if (args.text) {
                            finalResponseText = args.text;
                        }
                        logger.debug("event: Child agent sent message to parent via send_agent_message");
                    }
                }
                return toolResolver.execute(toolCall, toolContext);
            }
        };
        return {
            ...params,
            workerKey: rlmWorkerKeyResolve(executionContext.ctx),
            executionContext,
            trackingToolResolver,
            checkSteering: () => {
                const steering = agent.inbox.consumeSteering();
                if (steering) {
                    return { text: steering.text, origin: steering.origin };
                }
                return null;
            }
        };
    };

    const runPythonFailureHandle = async (
        blockState: AgentLoopBlockState,
        error: unknown,
        options?: { printOutput?: string[]; toolCallCount?: number }
    ): Promise<void> => {
        const message = error instanceof Error ? error.message : String(error);
        await appendHistoryRecord?.(
            rlmHistoryCompleteErrorRecordBuild(
                blockState.toolCallId,
                message,
                options?.printOutput ?? [],
                options?.toolCallCount ?? 0
            )
        );
        context.messages.push(rlmNoToolsResultMessageBuild({ error }));
        const truncated = agentMessageRunPythonFailureTrim(blockState.historyResponseText, blockState.blockIndex);
        if (truncated !== null && response?.message) {
            messageAssistantTextRewrite(response.message, truncated);
            await historyRecordAppend(
                historyRecords,
                {
                    type: "assistant_rewrite",
                    at: Date.now(),
                    assistantAt: blockState.assistantRecordAt,
                    text: truncated,
                    reason: "run_python_failure_trim"
                },
                appendHistoryRecord
            );
            logger.debug("event: Rewrote assistant message in context history after failed <run_python> block");
        }
    };

    try {
        logger.debug(`start: Starting inference loop maxIterations=${MAX_TOOL_ITERATIONS}`);
        let phase: AgentLoopPhase = { type: "inference", iteration: 0 };
        if (initialPhase) {
            try {
                activeSkills = await skills.list();
                await skills.syncToActive(options.skillsActiveRoot, activeSkills);
                context.tools = [];
            } catch (error) {
                logger.warn(
                    { agentId: agent.id, error },
                    "error: Failed to read skills before pending-phase recovery; continuing with previous snapshot"
                );
            }

            if (initialPhase.type === "vm_start") {
                const availableTools = toolResolver.listToolsForAgent(toolVisibilityContext);
                phase = {
                    type: "vm_start",
                    blockState: blockStateBuild({
                        iteration: 0,
                        blocks: initialPhase.blocks,
                        blockIndex: initialPhase.blockIndex,
                        preamble: montyPreambleBuild(availableTools),
                        toolCallId: createId(),
                        assistantRecordAt: initialPhase.assistantAt,
                        historyResponseText: initialPhase.historyResponseText
                    })
                };
            } else if (initialPhase.type === "tool_call") {
                const blockState = blockStateBuild({
                    iteration: 0,
                    blocks: initialPhase.blocks,
                    blockIndex: initialPhase.blockIndex,
                    preamble: initialPhase.start.preamble,
                    toolCallId: initialPhase.start.toolCallId,
                    assistantRecordAt: initialPhase.assistantAt,
                    historyResponseText: initialPhase.historyResponseText
                });
                const printOutput = [...initialPhase.snapshot.printOutput];
                const printCapture = rlmPrintCaptureCreate(printOutput);
                const printCallback = (...values: unknown[]): void => {
                    rlmPrintCaptureAppend(printCapture, values);
                };
                try {
                    const snapshotDump = Buffer.from(initialPhase.snapshot.snapshot, "base64");
                    const resumed = await rlmStepResume(
                        blockState.workerKey,
                        snapshotDump,
                        {
                            exception: {
                                type: "RuntimeError",
                                message: "Process was restarted"
                            }
                        },
                        printCallback
                    );
                    if (rlmVmSnapshotIs(resumed)) {
                        phase = {
                            type: "tool_call",
                            blockState,
                            snapshot: resumed,
                            printOutput,
                            printCapture,
                            printCallback,
                            toolCallCount: initialPhase.snapshot.toolCallCount
                        };
                    } else {
                        rlmPrintCaptureFlushTrailing(printCapture);
                        phase = {
                            type: "block_complete",
                            blockState,
                            result: {
                                output: rlmValueFormat(resumed.output),
                                printOutput,
                                toolCallCount: initialPhase.snapshot.toolCallCount
                            }
                        };
                    }
                } catch (error) {
                    rlmPrintCaptureFlushTrailing(printCapture);
                    await runPythonFailureHandle(blockState, error, {
                        printOutput,
                        toolCallCount: initialPhase.snapshot.toolCallCount
                    });
                    phase = restoreOnly ? { type: "done", reason: "complete" } : { type: "inference", iteration: 1 };
                }
            } else {
                phase = { type: "done", reason: "complete" };
            }
        }

        while (phase.type !== "done") {
            if (abortSignal?.aborted) {
                throw abortErrorBuild();
            }
            switch (phase.type) {
                case "inference": {
                    const iteration = phase.iteration;
                    if (iteration >= MAX_TOOL_ITERATIONS) {
                        logger.debug(`event: Tool loop limit reached iteration=${iteration}`);
                        toolLoopExceeded = true;
                        phase = { type: "done", reason: "tool_loop_limit" };
                        break;
                    }

                    let availableTools = toolResolver.listToolsForAgent(toolVisibilityContext);
                    try {
                        activeSkills = await skills.list();
                        await skills.syncToActive(options.skillsActiveRoot, activeSkills);
                        availableTools = toolResolver.listToolsForAgent(toolVisibilityContext);
                        context.tools = [];
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
                    const inferenceSessionId = agent.state.inferenceSessionId ?? agent.id;
                    try {
                        await agentInferencePromptWrite(agentSystem.config.current, agent.ctx, {
                            context,
                            sessionId: inferenceSessionId,
                            providersOverride: providersForAgent,
                            iteration
                        });
                    } catch (error) {
                        logger.warn({ agentId: agent.id, error }, "error: Failed to write inference prompt snapshot");
                    }
                    response = await inferenceRouter.complete(context, inferenceSessionId, {
                        providersOverride: providersForAgent,
                        providerOptions: {
                            stop: ["</run_python>"]
                        },
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
                    });

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
                            at: response.message.timestamp,
                            provider: tokensEntry.provider,
                            model: tokensEntry.model,
                            size: {
                                input: tokensEntry.size.input,
                                output: tokensEntry.size.output,
                                cacheRead: tokensEntry.size.cacheRead,
                                cacheWrite: tokensEntry.size.cacheWrite,
                                total: tokensEntry.size.total
                            },
                            cost: usageCostResolve(response.message.usage?.cost)
                        });
                    }

                    logger.debug(
                        `receive: Inference response received providerId=${response.providerId} modelId=${response.modelId} stopReason=${response.message.stopReason}`
                    );
                    context.messages.push(response.message);

                    let responseText = messageExtractText(response.message);
                    if (responseText) {
                        const terminalTrimmed = agentMessageRunPythonTerminalTrim(responseText);
                        if (terminalTrimmed !== null) {
                            responseText = terminalTrimmed;
                            messageAssistantTextRewrite(response.message, terminalTrimmed);
                            logger.debug("event: Trimmed inline RLM assistant text at first </run_python>");
                        }
                    }
                    let historyResponseText = responseText ?? "";
                    const pendingHistoryRewrites: Array<{
                        text: string;
                        reason: "run_python_say_after_trim" | "run_python_failure_trim";
                    }> = [];
                    const runPythonCodes = rlmNoToolsExtract(responseText ?? "");
                    const hasRunPythonTag = runPythonCodes.length > 0;
                    const suppressUserOutput = messageNoMessageIs(responseText);
                    if (suppressUserOutput) {
                        stripNoMessageTextBlocks(response.message);
                        logger.debug("event: NO_MESSAGE detected; suppressing user output for this response");
                    }
                    lastResponseNoMessage = suppressUserOutput;
                    const sayEnabled = agentKind === "foreground";
                    let effectiveResponseText: string | null = suppressUserOutput ? null : responseText;
                    const runPythonSplit =
                        hasRunPythonTag && effectiveResponseText ? runPythonResponseSplit(effectiveResponseText) : null;
                    if (hasRunPythonTag && responseText) {
                        const stripped = agentMessageRunPythonSayAfterTrim(responseText);
                        if (stripped !== null) {
                            historyResponseText = stripped;
                            pendingHistoryRewrites.push({
                                text: stripped,
                                reason: "run_python_say_after_trim"
                            });
                            messageAssistantTextRewrite(response.message, stripped);
                            logger.debug("event: Rewrote assistant message in context history after <run_python>");
                        }
                    }

                    if (sayEnabled && effectiveResponseText) {
                        let immediateSayText = effectiveResponseText;
                        if (hasRunPythonTag && runPythonSplit) {
                            immediateSayText = runPythonSplit.beforeRunPython;
                        }

                        const sayBlocks = tagExtractAll(immediateSayText, "say");
                        const sayFiles = sayFileExtract(immediateSayText);
                        const resolvedSayFiles =
                            sayFiles.length > 0
                                ? await sayFileResolve({
                                      files: sayFiles,
                                      sandbox: agent.sandbox,
                                      logger
                                  })
                                : [];

                        if (sayBlocks.length > 0) {
                            effectiveResponseText = null;
                            finalResponseText = sayBlocks[sayBlocks.length - 1]!;
                            lastResponseTextSent = true;
                            if (connector && targetId) {
                                try {
                                    for (let index = 0; index < sayBlocks.length; index += 1) {
                                        const block = sayBlocks[index]!;
                                        const filesForMessage =
                                            index === sayBlocks.length - 1 && resolvedSayFiles.length > 0
                                                ? resolvedSayFiles
                                                : undefined;
                                        await connector.sendMessage(targetId, {
                                            text: block,
                                            files: filesForMessage,
                                            replyToMessageId: entry.context.messageId
                                        });
                                        eventBus.emit("agent.outgoing", {
                                            agentId: agent.id,
                                            source,
                                            message: {
                                                text: block,
                                                files: filesForMessage
                                            },
                                            context: entry.context
                                        });
                                    }
                                } catch (error) {
                                    logger.warn(
                                        { connector: source, error },
                                        "error: Failed to send <say> response text"
                                    );
                                }
                            }
                        } else if (resolvedSayFiles.length > 0) {
                            effectiveResponseText = null;
                            finalResponseText = null;
                            lastResponseTextSent = true;
                            if (connector && targetId) {
                                try {
                                    await connector.sendMessage(targetId, {
                                        text: null,
                                        files: resolvedSayFiles,
                                        replyToMessageId: entry.context.messageId
                                    });
                                    eventBus.emit("agent.outgoing", {
                                        agentId: agent.id,
                                        source,
                                        message: {
                                            text: null,
                                            files: resolvedSayFiles
                                        },
                                        context: entry.context
                                    });
                                } catch (error) {
                                    logger.warn(
                                        { connector: source, error },
                                        "error: Failed to send <file> response files"
                                    );
                                }
                            }
                        } else {
                            effectiveResponseText = null;
                            finalResponseText = null;
                            lastResponseTextSent = true;
                            logger.debug("event: <say> feature enabled but no <say> tags found; suppressing output");
                        }
                    } else {
                        const trimmedText = effectiveResponseText?.trim() ?? "";
                        const hasResponseText = trimmedText.length > 0;
                        if (hasRunPythonTag) {
                            if (!childAgentMessageSent) {
                                finalResponseText = null;
                            }
                            lastResponseTextSent = true;
                            logger.debug("event: run_python tag detected; suppressing raw response text");
                        } else {
                            if (!childAgentMessageSent) {
                                finalResponseText = hasResponseText ? effectiveResponseText : null;
                            }
                            lastResponseTextSent = false;
                        }
                        if (hasResponseText && !hasRunPythonTag && connector && targetId) {
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
                    }

                    const assistantRecordAt = Date.now();
                    await historyRecordAppend(
                        historyRecords,
                        {
                            type: "assistant_message",
                            at: assistantRecordAt,
                            text: responseText ?? "",
                            files: [],
                            tokens: tokensEntry
                        },
                        appendHistoryRecord
                    );
                    for (const rewrite of pendingHistoryRewrites) {
                        await historyRecordAppend(
                            historyRecords,
                            {
                                type: "assistant_rewrite",
                                at: Date.now(),
                                assistantAt: assistantRecordAt,
                                text: rewrite.text,
                                reason: rewrite.reason
                            },
                            appendHistoryRecord
                        );
                    }

                    if (hasRunPythonTag) {
                        phase = {
                            type: "vm_start",
                            blockState: blockStateBuild({
                                iteration,
                                blocks: runPythonCodes,
                                blockIndex: 0,
                                preamble: montyPreambleBuild(availableTools),
                                toolCallId: createId(),
                                assistantRecordAt,
                                historyResponseText
                            })
                        };
                        break;
                    }

                    if (isChildAgent && !childAgentMessageSent) {
                        if (!childAgentNudged) {
                            childAgentNudged = true;
                            context.messages.push({
                                role: "user",
                                content: [
                                    {
                                        type: "text",
                                        text: "You haven't sent your results to your parent agent yet. Use the send_agent_message tool to deliver your results. No agentId is needed — it defaults to your parent."
                                    }
                                ],
                                timestamp: Date.now()
                            });
                            logger.debug("event: Child agent nudged to call send_agent_message");
                            phase = { type: "inference", iteration: iteration + 1 };
                            break;
                        }
                        logger.debug("event: Child agent did not send after nudge, accepting");
                    }

                    logger.debug(`event: No run_python blocks, breaking inference loop iteration=${iteration}`);
                    phase = { type: "done", reason: "complete" };
                    break;
                }
                case "vm_start": {
                    const blockState = phase.blockState;
                    const runPythonCode = blockState.blocks[blockState.blockIndex];
                    if (!runPythonCode) {
                        phase = restoreOnly
                            ? { type: "done", reason: "complete" }
                            : { type: "inference", iteration: blockState.iteration + 1 };
                        break;
                    }

                    const printOutput: string[] = [];
                    const printCapture = rlmPrintCaptureCreate(printOutput);
                    const printCallback = (...values: unknown[]): void => {
                        rlmPrintCaptureAppend(printCapture, values);
                    };

                    try {
                        await appendHistoryRecord?.({
                            type: "rlm_start",
                            at: Date.now(),
                            toolCallId: blockState.toolCallId,
                            code: runPythonCode,
                            preamble: blockState.preamble
                        });

                        const runtimeTools = rlmToolsForContextResolve(
                            blockState.trackingToolResolver,
                            blockState.executionContext
                        ).filter((tool) => tool.name !== RLM_TOOL_NAME);
                        const externalFunctions = runtimeTools.map((tool) => tool.name);
                        if (!externalFunctions.includes(SKIP_TOOL_NAME)) {
                            externalFunctions.push(SKIP_TOOL_NAME);
                        }

                        const progress = (
                            await rlmStepStart({
                                workerKey: blockState.workerKey,
                                code: runPythonCode,
                                preamble: blockState.preamble,
                                externalFunctions,
                                limits: RLM_LIMITS,
                                printCallback
                            })
                        ).progress;

                        if (rlmVmSnapshotIs(progress)) {
                            phase = {
                                type: "tool_call",
                                blockState,
                                snapshot: progress,
                                printOutput,
                                printCapture,
                                printCallback,
                                toolCallCount: 0
                            };
                            break;
                        }

                        rlmPrintCaptureFlushTrailing(printCapture);
                        phase = {
                            type: "block_complete",
                            blockState,
                            result: {
                                output: rlmValueFormat(progress.output),
                                printOutput,
                                toolCallCount: 0
                            }
                        };
                    } catch (error) {
                        await runPythonFailureHandle(blockState, error);
                        phase = restoreOnly
                            ? { type: "done", reason: "complete" }
                            : { type: "inference", iteration: blockState.iteration + 1 };
                    }
                    break;
                }
                case "tool_call": {
                    const blockState = phase.blockState;
                    try {
                        if (phase.snapshot.functionName === SKIP_TOOL_NAME) {
                            rlmPrintCaptureFlushTrailing(phase.printCapture);
                            phase = {
                                type: "block_complete",
                                blockState,
                                result: {
                                    output: "Turn skipped",
                                    printOutput: phase.printOutput,
                                    toolCallCount: phase.toolCallCount,
                                    skipTurn: true
                                }
                            };
                            break;
                        }

                        const runtimeTools = rlmToolsForContextResolve(
                            blockState.trackingToolResolver,
                            blockState.executionContext
                        ).filter((tool) => tool.name !== RLM_TOOL_NAME);
                        const toolByName = new Map(runtimeTools.map((tool) => [tool.name, tool]));

                        if (!toolByName.has(phase.snapshot.functionName)) {
                            const functionName = phase.snapshot.functionName;
                            const resumed = await rlmStepResume(
                                blockState.workerKey,
                                Buffer.from(phase.snapshot.dump()),
                                {
                                    exception: {
                                        type: "RuntimeError",
                                        message: `ToolError: Unknown tool: ${functionName}`
                                    }
                                },
                                phase.printCallback
                            );
                            if (rlmVmSnapshotIs(resumed)) {
                                phase = { ...phase, snapshot: resumed };
                                break;
                            }
                            rlmPrintCaptureFlushTrailing(phase.printCapture);
                            phase = {
                                type: "block_complete",
                                blockState,
                                result: {
                                    output: rlmValueFormat(resumed.output),
                                    printOutput: phase.printOutput,
                                    toolCallCount: phase.toolCallCount
                                }
                            };
                            break;
                        }

                        rlmPrintCaptureFlushTrailing(phase.printCapture);
                        const at = Date.now();
                        const currentPrintOutput = [...phase.printOutput];
                        const currentToolCallCount = phase.toolCallCount;
                        const stepResult = await rlmStepToolCall({
                            snapshot: phase.snapshot,
                            toolByName,
                            toolResolver: blockState.trackingToolResolver,
                            context: blockState.executionContext,
                            beforeExecute: async ({ snapshotDump, toolName, toolArgs }) => {
                                await appendHistoryRecord?.({
                                    type: "rlm_tool_call",
                                    at,
                                    toolCallId: blockState.toolCallId,
                                    snapshot: rlmSnapshotEncode(snapshotDump),
                                    printOutput: currentPrintOutput,
                                    toolCallCount: currentToolCallCount,
                                    toolName,
                                    toolArgs
                                });
                            }
                        });
                        const nextToolCallCount = phase.toolCallCount + 1;
                        await appendHistoryRecord?.({
                            type: "rlm_tool_result",
                            at: Date.now(),
                            toolCallId: blockState.toolCallId,
                            toolName: stepResult.toolName,
                            toolResult: stepResult.toolResult,
                            toolIsError: stepResult.toolIsError
                        });

                        const steering = blockState.checkSteering();
                        if (steering) {
                            rlmPrintCaptureFlushTrailing(phase.printCapture);
                            const printOutputSoFar =
                                phase.printOutput.length > 0
                                    ? `Print output so far:\n${phase.printOutput.join("\n")}\n\n`
                                    : "";
                            const steeringOutput = `<python_result>
Python execution interrupted by steering.

${printOutputSoFar}<steering_interrupt>
Message from ${steering.origin ?? "system"}: ${steering.text}
</steering_interrupt>
</python_result>`;

                            phase = {
                                type: "block_complete",
                                blockState,
                                result: {
                                    output: steeringOutput,
                                    printOutput: phase.printOutput,
                                    toolCallCount: nextToolCallCount,
                                    steeringInterrupt: {
                                        text: steering.text,
                                        origin: steering.origin
                                    }
                                }
                            };
                            break;
                        }

                        const resumed = await rlmStepResume(
                            blockState.workerKey,
                            stepResult.snapshotDump,
                            stepResult.resumeOptions,
                            phase.printCallback
                        );
                        if (rlmVmSnapshotIs(resumed)) {
                            phase = {
                                ...phase,
                                snapshot: resumed,
                                toolCallCount: nextToolCallCount
                            };
                            break;
                        }

                        rlmPrintCaptureFlushTrailing(phase.printCapture);
                        phase = {
                            type: "block_complete",
                            blockState,
                            result: {
                                output: rlmValueFormat(resumed.output),
                                printOutput: phase.printOutput,
                                toolCallCount: nextToolCallCount
                            }
                        };
                    } catch (error) {
                        if (isInferenceAbortError(error, abortSignal)) {
                            throw error;
                        }
                        await runPythonFailureHandle(blockState, error);
                        phase = restoreOnly
                            ? { type: "done", reason: "complete" }
                            : { type: "inference", iteration: blockState.iteration + 1 };
                    }
                    break;
                }
                case "block_complete": {
                    const { blockState, result } = phase;
                    await appendHistoryRecord?.({
                        type: "rlm_complete",
                        at: Date.now(),
                        toolCallId: blockState.toolCallId,
                        output: result.output,
                        printOutput: [...result.printOutput],
                        toolCallCount: result.toolCallCount,
                        isError: false
                    });
                    context.messages.push(rlmNoToolsResultMessageBuild({ result }));

                    if (result.skipTurn) {
                        context.messages.push({
                            role: "user",
                            content: [{ type: "text", text: "Turn skipped" }],
                            timestamp: Date.now()
                        });
                        logger.debug("event: Skip detected, appended 'Turn skipped' and breaking inference loop");
                        phase = { type: "done", reason: "skip_turn" };
                        break;
                    }

                    if (result.steeringInterrupt) {
                        phase = restoreOnly
                            ? { type: "done", reason: "complete" }
                            : { type: "inference", iteration: blockState.iteration + 1 };
                        break;
                    }

                    if (blockState.blockIndex + 1 < blockState.blocks.length) {
                        phase = {
                            type: "vm_start",
                            blockState: {
                                ...blockState,
                                blockIndex: blockState.blockIndex + 1,
                                toolCallId: createId()
                            }
                        };
                        break;
                    }

                    if (blockState.iteration === MAX_TOOL_ITERATIONS - 1) {
                        logger.debug(`event: Tool loop limit reached iteration=${blockState.iteration}`);
                        toolLoopExceeded = true;
                        phase = { type: "done", reason: "tool_loop_limit" };
                        break;
                    }

                    phase = restoreOnly
                        ? { type: "done", reason: "complete" }
                        : { type: "inference", iteration: blockState.iteration + 1 };
                    break;
                }
            }
        }
        logger.debug("event: Inference loop completed");
    } catch (error) {
        logger.debug(`error: Inference loop caught error error=${String(error)}`);
        if (isInferenceAbortError(error, abortSignal)) {
            logger.info({ agentId: agent.id }, "event: Inference aborted");
            return { responseText: finalResponseText, historyRecords, tokenStatsUpdates };
        }
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
        logger.info({ agentId: agent.id }, "event: Inference aborted by provider");
        return { responseText: finalResponseText, historyRecords, tokenStatsUpdates };
    }

    if (response.message.stopReason === "error") {
        const errorDetail =
            response.message.errorMessage && response.message.errorMessage.length > 0
                ? response.message.errorMessage
                : "unknown";
        if (
            inferenceErrorAnthropicPromptOverflowIs({
                providerId: response.providerId,
                errorMessage: response.message.errorMessage
            })
        ) {
            const contextOverflowTokens = inferenceErrorAnthropicPromptOverflowTokensExtract(
                response.message.errorMessage
            );
            logger.warn(
                `error: Inference returned Anthropic prompt overflow response provider=${response.providerId} model=${response.modelId} stopReason=${response.message.stopReason} error=${errorDetail}`
            );
            return {
                responseText: finalResponseText,
                historyRecords,
                contextOverflow: true,
                contextOverflowTokens,
                tokenStatsUpdates
            };
        }
        const message = "Inference failed.";
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
    logger.debug(`event: Extracted assistant text hasText=${hasResponseText} textLength=${responseText?.length ?? 0}`);

    if (!hasResponseText) {
        if (toolLoopExceeded) {
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
    const outgoingText = shouldSendText ? responseText : null;
    logger.debug(
        `send: Sending response to user textLength=${outgoingText?.length ?? 0} targetId=${targetId ?? "none"}`
    );
    try {
        if (connector && targetId && outgoingText) {
            await connector.sendMessage(targetId, {
                text: outgoingText,
                replyToMessageId: entry.context.messageId
            });
            logger.debug("send: Response sent successfully");
            eventBus.emit("agent.outgoing", {
                agentId: agent.id,
                source,
                message: {
                    text: outgoingText
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

async function historyRecordAppend(
    historyRecords: AgentHistoryRecord[],
    record: AgentHistoryRecord,
    appendHistoryRecord?: (record: AgentHistoryRecord) => Promise<void>
): Promise<void> {
    historyRecords.push(record);
    await appendHistoryRecord?.(record);
}

// Remove NO_MESSAGE text blocks so the sentinel never re-enters future model context.
function stripNoMessageTextBlocks(message: InferenceContext["messages"][number]): void {
    if (message.role !== "assistant" || !Array.isArray(message.content)) {
        return;
    }
    const nextContent = message.content.filter((block) => block.type !== "text");
    if (nextContent.length !== message.content.length) {
        message.content = nextContent;
    }
}

type RunPythonResponseSplit = {
    beforeRunPython: string;
    afterRunPython: string;
};

function runPythonResponseSplit(text: string): RunPythonResponseSplit | null {
    const openTagPattern = /<run_python(\s[^>]*)?>/i;
    const match = openTagPattern.exec(text);
    if (!match || match.index === undefined) {
        return null;
    }
    return {
        beforeRunPython: text.slice(0, match.index),
        afterRunPython: text.slice(match.index)
    };
}

function messageAssistantTextRewrite(message: InferenceContext["messages"][number], text: string): void {
    if (message.role !== "assistant") {
        return;
    }
    const nextContent: typeof message.content = [];
    let textRewritten = false;
    for (const part of message.content) {
        if (part.type !== "text") {
            nextContent.push(part);
            continue;
        }
        if (textRewritten) {
            continue;
        }
        nextContent.push({ ...part, text });
        textRewritten = true;
    }
    if (!textRewritten) {
        return;
    }
    message.content = nextContent;
}

function usageCostResolve(cost: unknown): number {
    if (!cost || typeof cost !== "object") {
        return 0;
    }
    const value = cost as {
        total?: unknown;
        input?: unknown;
        output?: unknown;
        cacheRead?: unknown;
        cacheWrite?: unknown;
    };
    const total = numberValueNormalize(value.total);
    if (total > 0) {
        return total;
    }
    return (
        numberValueNormalize(value.input) +
        numberValueNormalize(value.output) +
        numberValueNormalize(value.cacheRead) +
        numberValueNormalize(value.cacheWrite)
    );
}

function numberValueNormalize(value: unknown): number {
    if (typeof value !== "number" || !Number.isFinite(value)) {
        return 0;
    }
    if (value <= 0) {
        return 0;
    }
    return value;
}

function abortErrorBuild(): Error {
    const error = new Error("Operation aborted.");
    error.name = "AbortError";
    return error;
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
