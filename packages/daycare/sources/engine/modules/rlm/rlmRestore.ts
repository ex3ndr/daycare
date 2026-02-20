import { createId } from "@paralleldrive/cuid2";
import { type MontyComplete, MontySnapshot } from "@pydantic/monty";

import type { AgentHistoryRlmStartRecord, AgentHistoryRlmToolCallRecord, ToolExecutionContext } from "@/types";
import type { ToolResolverApi } from "../toolResolver.js";
import { RLM_PRINT_FUNCTION_NAME, RLM_TOOL_NAME } from "./rlmConstants.js";
import { rlmArgsConvert, rlmResultConvert } from "./rlmConvert.js";
import type { RlmCheckSteeringCallback, RlmExecuteResult, RlmHistoryCallback } from "./rlmExecute.js";

const RLM_RESTART_MESSAGE = "Process was restarted";

/**
 * Restores RLM execution from a persisted tool-call snapshot and continues execution.
 * Expects: snapshot is captured from `rlm_tool_call` immediately before an inner tool call.
 */
export async function rlmRestore(
    lastToolCall: AgentHistoryRlmToolCallRecord,
    startRecord: AgentHistoryRlmStartRecord,
    toolResolver: ToolResolverApi,
    context: ToolExecutionContext,
    historyCallback?: RlmHistoryCallback,
    checkSteering?: RlmCheckSteeringCallback
): Promise<RlmExecuteResult> {
    const availableTools = toolResolver.listTools().filter((tool) => tool.name !== RLM_TOOL_NAME);
    const toolByName = new Map(availableTools.map((tool) => [tool.name, tool]));
    const printOutput = [...lastToolCall.printOutput];
    let toolCallCount = lastToolCall.toolCallCount;
    const restored = MontySnapshot.load(Buffer.from(lastToolCall.snapshot, "base64"));
    let progress: MontySnapshot | MontyComplete = restored.resume({
        exception: {
            type: "RuntimeError",
            message: RLM_RESTART_MESSAGE
        }
    });

    while (progress instanceof MontySnapshot) {
        if (progress.functionName === RLM_PRINT_FUNCTION_NAME) {
            printOutput.push(printLineBuild(progress.args));
            progress = progress.resume({ returnValue: null });
            continue;
        }

        const tool = toolByName.get(progress.functionName);
        if (!tool) {
            progress = progress.resume({
                exception: {
                    type: "RuntimeError",
                    message: `ToolError: Unknown tool: ${progress.functionName}`
                }
            });
            continue;
        }

        const snapshotDump = progress.dump();
        const at = Date.now();
        let args: unknown = { args: progress.args, kwargs: progress.kwargs };
        let parsedArgs: unknown = null;
        let argsError: unknown = null;
        try {
            parsedArgs = rlmArgsConvert(progress.args, progress.kwargs, tool);
            args = parsedArgs;
        } catch (error) {
            argsError = error;
        }
        await historyCallback?.({
            type: "rlm_tool_call",
            at,
            toolCallId: startRecord.toolCallId,
            snapshot: snapshotEncode(snapshotDump),
            printOutput: [...printOutput],
            toolCallCount,
            toolName: tool.name,
            toolArgs: args
        });

        toolCallCount += 1;
        let resumeOptions: { returnValue: unknown } | { exception: { type: string; message: string } };
        let toolResultText = "";
        let toolIsError = false;
        try {
            if (argsError) {
                throw argsError;
            }
            const toolResult = await toolResolver.execute(
                {
                    type: "toolCall",
                    id: createId(),
                    name: tool.name,
                    arguments: parsedArgs as Record<string, unknown>
                },
                { ...context, rlmToolOnly: false }
            );
            const value = rlmResultConvert(toolResult);
            toolResultText = valueFormat(value);

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
            }
        } catch (error) {
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
        await historyCallback?.({
            type: "rlm_tool_result",
            at: Date.now(),
            toolCallId: startRecord.toolCallId,
            toolName: tool.name,
            toolResult: toolResultText,
            toolIsError
        });

        // Check for steering after each tool completes
        const steering = checkSteering?.();
        if (steering) {
            // Build result showing work done before interruption
            const printOutputSoFar =
                printOutput.length > 0 ? `Print output so far:\n${printOutput.join("\n")}\n\n` : "";

            const steeringOutput = `<python_result>
Python execution interrupted by steering.

${printOutputSoFar}<steering_interrupt>
Message from ${steering.origin ?? "system"}: ${steering.text}
</steering_interrupt>
</python_result>`;

            const steeringResult: RlmExecuteResult = {
                output: steeringOutput,
                printOutput,
                toolCallCount,
                steeringInterrupt: {
                    text: steering.text,
                    origin: steering.origin
                }
            };
            await historyCallback?.({
                type: "rlm_complete",
                at: Date.now(),
                toolCallId: startRecord.toolCallId,
                output: steeringResult.output,
                printOutput: [...steeringResult.printOutput],
                toolCallCount: steeringResult.toolCallCount,
                isError: false
            });
            return steeringResult;
        }

        progress = snapshotResumeWithDurationReset(snapshotDump, resumeOptions);
    }

    const result = {
        output: valueFormat(progress.output),
        printOutput,
        toolCallCount
    };
    await historyCallback?.({
        type: "rlm_complete",
        at: Date.now(),
        toolCallId: startRecord.toolCallId,
        output: result.output,
        printOutput: [...result.printOutput],
        toolCallCount: result.toolCallCount,
        isError: false
    });
    return result;
}

function snapshotResumeWithDurationReset(
    snapshotDump: Uint8Array,
    options: { returnValue: unknown } | { exception: { type: string; message: string } }
): MontySnapshot | MontyComplete {
    const restored = MontySnapshot.load(Buffer.from(snapshotDump));
    return restored.resume(options);
}

function snapshotEncode(snapshotDump: Uint8Array): string {
    return Buffer.from(snapshotDump).toString("base64");
}

function printLineBuild(args: unknown[]): string {
    return args
        .map((entry) => valueFormat(entry))
        .join(" ")
        .trimEnd();
}

function valueFormat(value: unknown): string {
    if (value === null || value === undefined) {
        return "";
    }
    if (typeof value === "string") {
        return value;
    }
    if (typeof value === "number" || typeof value === "boolean" || typeof value === "bigint") {
        return String(value);
    }
    if (value instanceof Map) {
        return valueFormat(Object.fromEntries(value.entries()));
    }
    if (Array.isArray(value)) {
        return value.map((entry) => valueFormat(entry)).join(", ");
    }
    if (typeof value === "object") {
        try {
            return JSON.stringify(value);
        } catch {
            return String(value);
        }
    }
    return String(value);
}
