import type { Tool } from "@mariozechner/pi-ai";
import { createId } from "@paralleldrive/cuid2";
import type { DeferredToolHandler, ResolvedTool, ToolExecutionContext } from "@/types";
import type { ToolResolverApi } from "../toolResolver.js";
import { toolMessageTextExtract } from "../tools/toolReturnOutcome.js";
import { CONTEXT_COMPACT_TOOL_NAME, CONTEXT_RESET_TOOL_NAME, STEP_TOOL_NAME } from "./rlmConstants.js";
import { rlmArgsConvert, rlmResultConvert, rlmRuntimeResultConvert } from "./rlmConvert.js";
import { rlmRuntimeToolExecute } from "./rlmRuntimeToolExecute.js";
import { rlmValueFormat } from "./rlmValueFormat.js";
import type { RlmVmSnapshot } from "./rlmVmProgress.js";
import type { RlmWorkerResumeOptions } from "./rlmWorkerProtocol.js";

export type RlmStepResumeOptions = RlmWorkerResumeOptions;

type RlmStepToolCallOptions = {
    snapshot: RlmVmSnapshot;
    toolByName: Map<string, ResolvedTool | Tool>;
    toolResolver: ToolResolverApi;
    context: ToolExecutionContext;
    beforeExecute?: (input: { snapshotDump: Uint8Array; toolName: string; toolArgs: unknown }) => Promise<void>;
};

export type RlmStepToolCallResult = {
    snapshotDump: Uint8Array;
    toolName: string;
    toolArgs: unknown;
    toolResult: string;
    toolIsError: boolean;
    resumeOptions: RlmStepResumeOptions;
    /** Deferred payload from the tool, only set on successful non-error results. */
    deferredPayload?: unknown;
    /** Handler to flush the deferred payload after successful script completion. */
    deferredHandler?: DeferredToolHandler;
};

/**
 * Executes one paused Monty tool call and prepares resume options.
 * Expects: caller persists history records and performs VM resume separately.
 */
export async function rlmStepToolCall(options: RlmStepToolCallOptions): Promise<RlmStepToolCallResult> {
    const toolName = options.snapshot.functionName;
    const snapshotArgs = options.snapshot.args;
    const snapshotKwargs = options.snapshot.kwargs;
    const snapshotDump = Buffer.from(options.snapshot.dump());
    const toolEntry = options.toolByName.get(toolName);
    if (!toolEntry) {
        const message = `ToolError: Unknown tool: ${toolName}`;
        return {
            snapshotDump,
            toolName,
            toolArgs: { args: snapshotArgs, kwargs: snapshotKwargs },
            toolResult: message,
            toolIsError: true,
            resumeOptions: {
                exception: {
                    type: "RuntimeError",
                    message
                }
            }
        };
    }

    let toolArgs: unknown = { args: snapshotArgs, kwargs: snapshotKwargs };
    let parsedArgs: unknown = null;
    let argsError: unknown = null;
    try {
        parsedArgs = rlmArgsConvert(snapshotArgs, snapshotKwargs, toolEntry);
        toolArgs = parsedArgs;
    } catch (error) {
        argsError = error;
    }
    let resumeOptions: RlmStepResumeOptions;
    let toolResultText = "";
    let toolIsError = false;
    let deferredPayload: unknown;
    let deferredHandler: DeferredToolHandler | undefined;
    try {
        await options.beforeExecute?.({
            snapshotDump,
            toolName: toolNameResolve(toolEntry),
            toolArgs
        });
        if (argsError) {
            throw argsError;
        }
        const runtimeResult = await rlmRuntimeToolExecute(toolNameResolve(toolEntry), parsedArgs, options.context);
        if (runtimeResult.handled) {
            const value = runtimeVoidToolIs(toolNameResolve(toolEntry))
                ? null
                : rlmRuntimeResultConvert(runtimeResult.value, toolEntry);
            toolResultText = rlmValueFormat(value);
            resumeOptions = {
                returnValue: value
            };
        } else {
            const toolResult = await options.toolResolver.execute(
                {
                    type: "toolCall",
                    id: createId(),
                    name: toolNameResolve(toolEntry),
                    arguments: parsedArgs as Record<string, unknown>
                },
                { ...options.context, pythonExecution: true }
            );

            if (toolResult.toolMessage.isError) {
                toolIsError = true;
                toolResultText = toolMessageTextExtract(toolResult.toolMessage).trim();
                if (toolResultText.length === 0) {
                    toolResultText = `Tool execution failed: ${toolNameResolve(toolEntry)}`;
                }
                resumeOptions = {
                    exception: {
                        type: "RuntimeError",
                        message: toolResultText
                    }
                };
            } else {
                const value = rlmResultConvert(toolResult, toolEntry);
                toolResultText = rlmValueFormat(value);
                resumeOptions = { returnValue: value };
                deferredPayload = toolResult.deferredPayload;
                deferredHandler = toolResult.deferredHandler;
            }
        }
    } catch (error) {
        if (abortErrorIs(error, options.context.abortSignal)) {
            throw error;
        }
        const message = error instanceof Error ? error.message : String(error);
        toolResultText = `ToolError: ${message}`;
        toolIsError = true;
        resumeOptions = {
            exception: {
                type: "RuntimeError",
                message: toolResultText
            }
        };
    }

    return {
        snapshotDump,
        toolName,
        toolArgs,
        toolResult: toolResultText,
        toolIsError,
        resumeOptions,
        deferredPayload,
        deferredHandler
    };
}

function runtimeVoidToolIs(name: string): boolean {
    return name === STEP_TOOL_NAME || name === CONTEXT_RESET_TOOL_NAME || name === CONTEXT_COMPACT_TOOL_NAME;
}

function toolNameResolve(tool: ResolvedTool | Tool): string {
    return "tool" in tool ? tool.tool.name : tool.name;
}

function abortErrorIs(error: unknown, signal?: AbortSignal): boolean {
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
