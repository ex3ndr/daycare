import type { Context as InferenceContext, ToolResultMessage } from "@mariozechner/pi-ai";
import { createId } from "@paralleldrive/cuid2";
import type { Logger } from "pino";
import type { AgentSkill, Connector } from "@/types";
import type { AuthStore } from "../../../auth/store.js";
import type { AssistantSettings, ProviderSettings } from "../../../settings.js";
import { tagExtract, tagExtractAll } from "../../../util/tagExtract.js";
import type { Heartbeats } from "../../heartbeat/heartbeats.js";
import type { EngineEventBus } from "../../ipc/events.js";
import type { Memory } from "../../memory/memory.js";
import { messageExtractText } from "../../messages/messageExtractText.js";
import { messageExtractToolCalls } from "../../messages/messageExtractToolCalls.js";
import { messageNoMessageIs } from "../../messages/messageNoMessageIs.js";
import type { ConnectorRegistry } from "../../modules/connectorRegistry.js";
import type { InferenceRouter } from "../../modules/inference/router.js";
import { montyRuntimePreambleBuild } from "../../modules/monty/montyRuntimePreambleBuild.js";
import { SKIP_TOOL_NAME } from "../../modules/rlm/rlmConstants.js";
import { rlmExecute } from "../../modules/rlm/rlmExecute.js";
import { rlmHistoryCompleteErrorRecordBuild } from "../../modules/rlm/rlmHistoryCompleteErrorRecordBuild.js";
import { rlmNoToolsExtract } from "../../modules/rlm/rlmNoToolsExtract.js";
import { rlmNoToolsModeIs } from "../../modules/rlm/rlmNoToolsModeIs.js";
import { rlmNoToolsResultMessageBuild } from "../../modules/rlm/rlmNoToolsResultMessageBuild.js";
import { rlmToolDescriptionBuild } from "../../modules/rlm/rlmToolDescriptionBuild.js";
import { sayFileExtract } from "../../modules/say/sayFileExtract.js";
import { sayFileResolve } from "../../modules/say/sayFileResolve.js";
import type { ToolResolverApi } from "../../modules/toolResolver.js";
import { toolArgsFormatVerbose } from "../../modules/tools/toolArgsFormatVerbose.js";
import { toolListContextBuild } from "../../modules/tools/toolListContextBuild.js";
import { toolResultFormatVerbose } from "../../modules/tools/toolResultFormatVerbose.js";
import { toolExecutionResultOutcome } from "../../modules/tools/toolReturnOutcome.js";
import type { Skills } from "../../skills/skills.js";
import type { Agent } from "../agent.js";
import type { AgentSystem } from "../agentSystem.js";
import { agentDescriptorTargetResolve } from "./agentDescriptorTargetResolve.js";
import { agentHistoryPendingToolResults } from "./agentHistoryPendingToolResults.js";
import { agentInferencePromptWrite } from "./agentInferencePromptWrite.js";
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
    contextOverflowTokens?: number;
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
        authStore,
        eventBus,
        assistant,
        agentSystem,
        heartbeats,
        memory,
        skills,
        providersForAgent,
        verbose,
        logger,
        abortSignal,
        appendHistoryRecord,
        notifySubagentFailure
    } = options;

    let response: Awaited<ReturnType<InferenceRouter["complete"]>> | null = null;
    let skipTurnDetected = false;
    let toolLoopExceeded = false;
    let lastResponseHadToolCalls = false;
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
    let childAgentResponded = false;
    const agentKind =
        agent.descriptor.type === "user" || agent.descriptor.type === "subuser" ? "foreground" : "background";
    const target = agentDescriptorTargetResolve(agent.descriptor);
    const targetId = target?.targetId ?? null;
    const toolVisibilityContext = {
        ctx: agent.ctx,
        descriptor: agent.descriptor
    };
    const allowedToolNames = agentToolExecutionAllowlistResolve(agent.descriptor, {
        rlmEnabled: agentSystem.config.current.features.rlm
    });
    logger.debug(`start: Starting typing indicator targetId=${targetId ?? "none"}`);
    const stopTyping = targetId ? connector?.startTyping?.(targetId) : null;

    try {
        logger.debug(`start: Starting inference loop maxIterations=${MAX_TOOL_ITERATIONS}`);
        for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration += 1) {
            const noToolsModeEnabled = rlmNoToolsModeIs(agentSystem.config.current.features);
            let availableTools = toolResolver.listToolsForAgent(toolVisibilityContext);
            try {
                activeSkills = await skills.list();
                await skills.syncToActive(options.skillsActiveRoot, activeSkills);
                availableTools = toolResolver.listToolsForAgent(toolVisibilityContext);
                const rlmToolDescription =
                    agentSystem.config.current.features.rlm && !noToolsModeEnabled
                        ? await rlmToolDescriptionBuild(availableTools)
                        : undefined;
                context.tools = toolListContextBuild({
                    tools: availableTools,
                    source,
                    agentKind,
                    noTools: noToolsModeEnabled,
                    rlm: agentSystem.config.current.features.rlm,
                    rlmToolDescription,
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
                providerOptions: noToolsModeEnabled
                    ? {
                          stop: ["</run_python>"]
                      }
                    : undefined,
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
                    logger.debug(`error: Inference failed completely providerId=${providerId} error=${String(error)}`);
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

            let responseText = messageExtractText(response.message);
            if (noToolsModeEnabled && responseText) {
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
            const toolCalls = messageExtractToolCalls(response.message);
            const runPythonCodes = noToolsModeEnabled ? rlmNoToolsExtract(responseText ?? "") : [];
            const hasRunPythonTag = runPythonCodes.length > 0;
            lastResponseHadToolCalls = toolCalls.length > 0;
            const suppressUserOutput = messageNoMessageIs(responseText);
            if (suppressUserOutput) {
                stripNoMessageTextBlocks(response.message);
                logger.debug("event: NO_MESSAGE detected; suppressing user output for this response");
            }
            lastResponseNoMessage = suppressUserOutput;
            const sayEnabled = agentSystem.config.current.features.say && agentKind === "foreground";
            let effectiveResponseText: string | null = suppressUserOutput ? null : responseText;
            const runPythonSplit =
                hasRunPythonTag && effectiveResponseText ? runPythonResponseSplit(effectiveResponseText) : null;
            if (noToolsModeEnabled && hasRunPythonTag && responseText) {
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

            // <say> tag mode: only send text inside <say> blocks, suppress the rest
            if (sayEnabled && effectiveResponseText) {
                let immediateSayText = effectiveResponseText;
                if (noToolsModeEnabled && hasRunPythonTag && runPythonSplit) {
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
                    effectiveResponseText = null; // suppress full text
                    finalResponseText = sayBlocks[sayBlocks.length - 1]!;
                    // Never fall back to raw assistant text when <say> blocks exist.
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
                            logger.warn({ connector: source, error }, "error: Failed to send <say> response text");
                        }
                    }
                } else if (resolvedSayFiles.length > 0) {
                    effectiveResponseText = null;
                    finalResponseText = null;
                    lastResponseTextSent = true; // prevent post-loop fallback send
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
                            logger.warn({ connector: source, error }, "error: Failed to send <file> response files");
                        }
                    }
                } else {
                    // No <say> blocks: suppress entire output
                    effectiveResponseText = null;
                    finalResponseText = null;
                    lastResponseTextSent = true; // prevent post-loop fallback send
                    logger.debug("event: <say> feature enabled but no <say> tags found; suppressing output");
                }
            } else {
                const trimmedText = effectiveResponseText?.trim() ?? "";
                const hasResponseText = trimmedText.length > 0;
                if (hasRunPythonTag) {
                    // Hide raw <run_python> payloads from end users; execution result is injected next turn.
                    finalResponseText = null;
                    lastResponseTextSent = true;
                    logger.debug("event: noTools run_python tag detected; suppressing raw response text");
                } else {
                    finalResponseText = hasResponseText ? effectiveResponseText : null;
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

            logger.debug(`event: Extracted tool calls from response toolCallCount=${toolCalls.length}`);
            const assistantRecordAt = Date.now();
            await historyRecordAppend(
                historyRecords,
                {
                    type: "assistant_message",
                    at: assistantRecordAt,
                    text: responseText ?? "",
                    files: [],
                    toolCalls,
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

            // Child-agent <response> tag: check on every iteration, deliver each one to parent
            if (isChildAgent) {
                const extracted = tagExtract(responseText ?? "", "response");
                if (extracted !== null) {
                    finalResponseText = extracted;
                    childAgentResponded = true;
                    await subagentDeliverResponse(agentSystem, agent, extracted, logger);
                }
            }

            if (noToolsModeEnabled) {
                if (hasRunPythonTag) {
                    const preamble = montyRuntimePreambleBuild(availableTools);
                    const executionContext = {
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
                        skillsActiveRoot: options.skillsActiveRoot,
                        skillsPersonalRoot: options.skillsPersonalRoot,
                        appendHistoryRecord,
                        rlmToolOnly: false,
                        allowedToolNames
                    };

                    for (let index = 0; index < runPythonCodes.length; index += 1) {
                        const runPythonCode = runPythonCodes[index]!;
                        const toolCallId = createId();

                        try {
                            // Create steering check callback that consumes steering if present
                            const checkSteering = () => {
                                const steering = agent.inbox.consumeSteering();
                                if (steering) {
                                    return { text: steering.text, origin: steering.origin };
                                }
                                return null;
                            };
                            const result = await rlmExecute(
                                runPythonCode,
                                preamble,
                                executionContext,
                                toolResolver,
                                toolCallId,
                                appendHistoryRecord,
                                checkSteering
                            );
                            context.messages.push(rlmNoToolsResultMessageBuild({ result }));

                            // If steering interrupted, break out of the code loop
                            if (result.steeringInterrupt) {
                                break;
                            }

                            // If skip() was called, break out of the code loop
                            if (result.skipTurn) {
                                skipTurnDetected = true;
                                break;
                            }
                        } catch (error) {
                            const message = error instanceof Error ? error.message : String(error);
                            await appendHistoryRecord?.(rlmHistoryCompleteErrorRecordBuild(toolCallId, message));
                            context.messages.push(rlmNoToolsResultMessageBuild({ error }));
                            const truncated = agentMessageRunPythonFailureTrim(historyResponseText, index);
                            if (truncated !== null) {
                                historyResponseText = truncated;
                                messageAssistantTextRewrite(response.message, truncated);
                                await historyRecordAppend(
                                    historyRecords,
                                    {
                                        type: "assistant_rewrite",
                                        at: Date.now(),
                                        assistantAt: assistantRecordAt,
                                        text: truncated,
                                        reason: "run_python_failure_trim"
                                    },
                                    appendHistoryRecord
                                );
                                logger.debug(
                                    "event: Rewrote assistant message in context history after failed <run_python> block"
                                );
                            }
                            break;
                        }
                    }

                    if (skipTurnDetected) {
                        break;
                    }

                    if (iteration === MAX_TOOL_ITERATIONS - 1) {
                        logger.debug(`event: Tool loop limit reached iteration=${iteration}`);
                        toolLoopExceeded = true;
                    }
                    continue;
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

            for (let toolIndex = 0; toolIndex < toolCalls.length; toolIndex++) {
                const toolCall = toolCalls[toolIndex]!;
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
                    skillsActiveRoot: options.skillsActiveRoot,
                    skillsPersonalRoot: options.skillsPersonalRoot,
                    appendHistoryRecord,
                    rlmToolOnly: agentSystem.config.current.features.rlm,
                    allowedToolNames
                });
                logger.debug(
                    `event: Tool execution completed toolName=${toolCall.name} isError=${toolResult.toolMessage.isError}`
                );

                if (verbose && !suppressUserOutput && connector && targetId) {
                    const resultText = toolResultFormatVerbose(toolResult);
                    await connector.sendMessage(targetId, {
                        text: resultText
                    });
                }

                context.messages.push(toolResult.toolMessage);
                await historyRecordAppend(
                    historyRecords,
                    {
                        type: "tool_result",
                        at: Date.now(),
                        toolCallId: toolCall.id,
                        output: toolResult
                    },
                    appendHistoryRecord
                );

                // Check for skip: direct skip tool call or run_python that internally called skip()
                if (toolCall.name === SKIP_TOOL_NAME || toolResult.skipTurn) {
                    logger.debug("event: Skip tool detected, aborting inference loop");
                    skipTurnDetected = true;

                    // Cancel remaining tool calls
                    for (let cancelIndex = toolIndex + 1; cancelIndex < toolCalls.length; cancelIndex++) {
                        const cancelledCall = toolCalls[cancelIndex]!;
                        const cancelledMessage: ToolResultMessage = {
                            role: "toolResult",
                            toolCallId: cancelledCall.id,
                            toolName: cancelledCall.name,
                            content: [{ type: "text", text: "Turn skipped" }],
                            isError: true,
                            timestamp: Date.now()
                        };
                        const cancelledResult = toolExecutionResultOutcome(cancelledMessage);
                        context.messages.push(cancelledMessage);
                        await historyRecordAppend(
                            historyRecords,
                            {
                                type: "tool_result",
                                at: Date.now(),
                                toolCallId: cancelledCall.id,
                                output: cancelledResult
                            },
                            appendHistoryRecord
                        );
                    }
                    break;
                }

                // Check for steering after each tool call
                if (agent.inbox.hasSteering()) {
                    const steering = agent.inbox.consumeSteering();
                    if (steering) {
                        logger.debug(
                            `event: Steering received, cancelling remaining tool calls steeringOrigin=${steering.origin ?? "unknown"}`
                        );

                        // Cancel remaining tool calls with steering reason
                        const cancelReason = steering.cancelReason ?? "Task redirected by steering message";
                        for (let cancelIndex = toolIndex + 1; cancelIndex < toolCalls.length; cancelIndex++) {
                            const cancelledCall = toolCalls[cancelIndex]!;
                            const cancelledMessage: ToolResultMessage = {
                                role: "toolResult",
                                toolCallId: cancelledCall.id,
                                toolName: cancelledCall.name,
                                content: [{ type: "text", text: cancelReason }],
                                isError: true,
                                timestamp: Date.now()
                            };
                            const cancelledResult = toolExecutionResultOutcome(cancelledMessage);

                            context.messages.push(cancelledMessage);
                            await historyRecordAppend(
                                historyRecords,
                                {
                                    type: "tool_result",
                                    at: Date.now(),
                                    toolCallId: cancelledCall.id,
                                    output: cancelledResult
                                },
                                appendHistoryRecord
                            );

                            logger.debug(
                                `event: Tool call cancelled by steering toolName=${cancelledCall.name} toolCallId=${cancelledCall.id}`
                            );
                        }

                        // Inject steering message into context as a system message
                        // The steering message will be processed by the agent's runLoop on next iteration
                        context.messages.push({
                            role: "user",
                            content: [
                                {
                                    type: "text",
                                    text: `<system_message origin="${steering.origin ?? "steering"}">\n${steering.text}\n</system_message>`
                                }
                            ],
                            timestamp: Date.now()
                        });

                        // Break out of tool loop - steering message will drive next inference
                        break;
                    }
                }
            }

            if (skipTurnDetected) {
                context.messages.push({
                    role: "user",
                    content: [{ type: "text", text: "Turn skipped" }],
                    timestamp: Date.now()
                });
                logger.debug("event: Skip detected, appended 'Turn skipped' and breaking inference loop");
                break;
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
            await historyPendingToolCallsComplete(historyRecords, "user_aborted", appendHistoryRecord);
            logger.info({ agentId: agent.id }, "event: Inference aborted");
            return { responseText: finalResponseText, historyRecords, tokenStatsUpdates };
        }
        await historyPendingToolCallsComplete(historyRecords, "session_crashed", appendHistoryRecord);
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
        await historyPendingToolCallsComplete(historyRecords, "user_aborted", appendHistoryRecord);
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

async function historyPendingToolCallsComplete(
    historyRecords: AgentHistoryRecord[],
    reason: "session_crashed" | "user_aborted",
    appendHistoryRecord?: (record: AgentHistoryRecord) => Promise<void>
): Promise<void> {
    const completionRecords = agentHistoryPendingToolResults(historyRecords, reason, Date.now());
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
    if (
        agent.descriptor.type !== "subagent" &&
        agent.descriptor.type !== "app" &&
        agent.descriptor.type !== "memory-search"
    ) {
        return;
    }
    const parentAgentId = agent.descriptor.parentAgentId ?? null;
    if (!parentAgentId) {
        return;
    }
    try {
        await agentSystem.post(
            agent.ctx,
            { agentId: parentAgentId },
            { type: "system_message", text, origin: agent.id }
        );
        logger.debug("event: Child agent <response> delivered to parent");
    } catch (error) {
        logger.warn({ agentId: agent.id, parentAgentId, error }, "error: Child agent response delivery failed");
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
