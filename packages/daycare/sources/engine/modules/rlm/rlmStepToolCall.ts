import type { Tool } from "@mariozechner/pi-ai";
import { createId } from "@paralleldrive/cuid2";

import type { DeferredToolHandler, ToolExecutionContext } from "@/types";
import type { ToolResolverApi } from "../toolResolver.js";
import { rlmArgsConvert, rlmResultConvert } from "./rlmConvert.js";
import { rlmRuntimeToolExecute } from "./rlmRuntimeToolExecute.js";
import { rlmValueFormat } from "./rlmValueFormat.js";
import type { RlmVmSnapshot } from "./rlmVmProgress.js";
import type { RlmWorkerResumeOptions } from "./rlmWorkerProtocol.js";

export type RlmStepResumeOptions = RlmWorkerResumeOptions;

type RlmStepToolCallOptions = {
    snapshot: RlmVmSnapshot;
    toolByName: Map<string, Tool>;
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
    const tool = options.toolByName.get(toolName);
    if (!tool) {
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
        parsedArgs = rlmArgsConvert(snapshotArgs, snapshotKwargs, tool);
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
            toolName: tool.name,
            toolArgs
        });
        if (argsError) {
            throw argsError;
        }
        const runtimeResult = rlmRuntimeToolExecute(tool.name, parsedArgs);
        if (runtimeResult.handled) {
            toolResultText = rlmValueFormat(runtimeResult.value);
            resumeOptions = {
                returnValue: runtimeResult.value
            };
        } else {
            const toolResult = await options.toolResolver.execute(
                {
                    type: "toolCall",
                    id: createId(),
                    name: tool.name,
                    arguments: parsedArgs as Record<string, unknown>
                },
                { ...options.context, pythonExecution: true }
            );
            const value = rlmResultConvert(toolResult);
            toolResultText = rlmValueFormat(value);

            if (toolResult.toolMessage.isError) {
                toolIsError = true;
                resumeOptions = {
                    exception: {
                        type: "RuntimeError",
                        message:
                            toolResultText.trim().length > 0 ? toolResultText : `Tool execution failed: ${tool.name}`
                    }
                };
            } else {
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
