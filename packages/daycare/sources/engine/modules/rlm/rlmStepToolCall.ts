import type { Tool } from "@mariozechner/pi-ai";
import { createId } from "@paralleldrive/cuid2";
import type { MontySnapshot } from "@pydantic/monty";

import type { ToolExecutionContext } from "@/types";
import type { ToolResolverApi } from "../toolResolver.js";
import { rlmArgsConvert, rlmResultConvert } from "./rlmConvert.js";
import { rlmValueFormat } from "./rlmValueFormat.js";

export type RlmStepResumeOptions = { returnValue: unknown } | { exception: { type: string; message: string } };

type RlmStepToolCallOptions = {
    snapshot: MontySnapshot;
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
};

/**
 * Executes one paused Monty tool call and prepares resume options.
 * Expects: caller persists history records and performs VM resume separately.
 */
export async function rlmStepToolCall(options: RlmStepToolCallOptions): Promise<RlmStepToolCallResult> {
    const snapshotDump = options.snapshot.dump();
    const toolName = options.snapshot.functionName;
    const tool = options.toolByName.get(toolName);
    if (!tool) {
        const message = `ToolError: Unknown tool: ${toolName}`;
        return {
            snapshotDump,
            toolName,
            toolArgs: { args: options.snapshot.args, kwargs: options.snapshot.kwargs },
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

    let toolArgs: unknown = { args: options.snapshot.args, kwargs: options.snapshot.kwargs };
    let parsedArgs: unknown = null;
    let argsError: unknown = null;
    try {
        parsedArgs = rlmArgsConvert(options.snapshot.args, options.snapshot.kwargs, tool);
        toolArgs = parsedArgs;
    } catch (error) {
        argsError = error;
    }
    await options.beforeExecute?.({
        snapshotDump,
        toolName: tool.name,
        toolArgs
    });

    let resumeOptions: RlmStepResumeOptions;
    let toolResultText = "";
    let toolIsError = false;
    try {
        if (argsError) {
            throw argsError;
        }
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
                    message: toolResultText.trim().length > 0 ? toolResultText : `Tool execution failed: ${tool.name}`
                }
            };
        } else {
            resumeOptions = { returnValue: value };
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
        resumeOptions
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
