import { type MontyComplete, MontySnapshot } from "@pydantic/monty";

import type { AgentHistoryRecord, ToolExecutionContext } from "@/types";
import type { ToolResolverApi } from "../toolResolver.js";
import { RLM_TOOL_NAME, SKIP_TOOL_NAME } from "./rlmConstants.js";
import { RLM_LIMITS } from "./rlmLimits.js";
import { rlmPrintCaptureAppend, rlmPrintCaptureCreate, rlmPrintCaptureFlushTrailing } from "./rlmPrintCapture.js";
import { rlmSnapshotCreate } from "./rlmSnapshotCreate.js";
import { rlmSnapshotEncode } from "./rlmSnapshotEncode.js";
import { rlmStepResume } from "./rlmStepResume.js";
import { rlmStepStart } from "./rlmStepStart.js";
import { rlmStepToolCall } from "./rlmStepToolCall.js";
import { rlmToolsForContextResolve } from "./rlmToolsForContextResolve.js";
import { rlmValueFormat } from "./rlmValueFormat.js";
import { rlmVmSnapshotIs } from "./rlmVmProgress.js";
import { rlmWorkerKeyResolve } from "./rlmWorkerKeyResolve.js";

export type RlmExecuteResult = {
    output: string;
    printOutput: string[];
    toolCallCount: number;
    steeringInterrupt?: {
        text: string;
        origin?: string;
    };
    skipTurn?: boolean;
};

export type RlmHistoryCallback = (record: AgentHistoryRecord) => Promise<void>;

export type RlmSteeringInfo = {
    text: string;
    origin?: string;
};

export type RlmCheckSteeringCallback = () => RlmSteeringInfo | null;

/**
 * Executes Monty Python code by routing external function calls into ToolResolver.
 * Expects: preamble matches the currently available tool names.
 */
export async function rlmExecute(
    code: string,
    preamble: string,
    context: ToolExecutionContext,
    toolResolver: ToolResolverApi,
    toolCallId: string,
    historyCallback?: RlmHistoryCallback,
    checkSteering?: RlmCheckSteeringCallback
): Promise<RlmExecuteResult> {
    const availableTools = rlmToolsForContextResolve(toolResolver, context).filter(
        (tool) => tool.name !== RLM_TOOL_NAME
    );
    const workerKey = rlmWorkerKeyResolve(context.ctx);
    const toolByName = new Map(availableTools.map((tool) => [tool.name, tool]));
    const externalFunctions = [...toolByName.keys()];
    if (!externalFunctions.includes(SKIP_TOOL_NAME)) {
        externalFunctions.push(SKIP_TOOL_NAME);
    }
    await historyCallback?.({
        type: "rlm_start",
        at: Date.now(),
        toolCallId,
        code,
        preamble
    });

    const printOutput: string[] = [];
    const printCapture = rlmPrintCaptureCreate(printOutput);
    const printCallback = (...values: unknown[]): void => {
        rlmPrintCaptureAppend(printCapture, values);
    };
    let toolCallCount = 0;
    let progress = (
        await rlmStepStart({
            workerKey,
            code,
            preamble,
            externalFunctions,
            limits: RLM_LIMITS,
            printCallback
        })
    ).progress;

    while (rlmVmSnapshotIs(progress)) {
        if (progress.functionName === SKIP_TOOL_NAME) {
            rlmPrintCaptureFlushTrailing(printCapture);
            const skipResult: RlmExecuteResult = {
                output: "Turn skipped",
                printOutput,
                toolCallCount,
                skipTurn: true
            };
            await historyCallback?.({
                type: "rlm_complete",
                at: Date.now(),
                toolCallId,
                output: skipResult.output,
                printOutput: [...skipResult.printOutput],
                toolCallCount: skipResult.toolCallCount,
                isError: false
            });
            return skipResult;
        }

        if (!toolByName.has(progress.functionName)) {
            const functionName = progress.functionName;
            const snapshotDump = Buffer.from(progress.dump());
            progress = await rlmStepResume(
                workerKey,
                snapshotDump,
                {
                    exception: {
                        type: "RuntimeError",
                        message: `ToolError: Unknown tool: ${functionName}`
                    }
                },
                printCallback
            );
            continue;
        }

        rlmPrintCaptureFlushTrailing(printCapture);
        const at = Date.now();
        const stepResult = await rlmStepToolCall({
            snapshot: progress,
            toolByName,
            toolResolver,
            context,
            beforeExecute: async ({ snapshotDump, toolName, toolArgs }) => {
                if (!historyCallback) {
                    return;
                }
                const snapshotId = await rlmSnapshotIdResolve(context, at, snapshotDump);
                if (!snapshotId) {
                    return;
                }
                await historyCallback({
                    type: "rlm_tool_call",
                    at,
                    toolCallId,
                    snapshotId,
                    printOutput: [...printOutput],
                    toolCallCount,
                    toolName,
                    toolArgs
                });
            }
        });
        toolCallCount += 1;
        await historyCallback?.({
            type: "rlm_tool_result",
            at: Date.now(),
            toolCallId,
            toolName: stepResult.toolName,
            toolResult: stepResult.toolResult,
            toolIsError: stepResult.toolIsError
        });

        const steering = checkSteering?.();
        if (steering) {
            rlmPrintCaptureFlushTrailing(printCapture);
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
                toolCallId,
                output: steeringResult.output,
                printOutput: [...steeringResult.printOutput],
                toolCallCount: steeringResult.toolCallCount,
                isError: false
            });
            return steeringResult;
        }

        progress = await rlmStepResume(workerKey, stepResult.snapshotDump, stepResult.resumeOptions, printCallback);
    }

    rlmPrintCaptureFlushTrailing(printCapture);
    const result: RlmExecuteResult = {
        output: rlmValueFormat(progress.output),
        printOutput,
        toolCallCount
    };
    await historyCallback?.({
        type: "rlm_complete",
        at: Date.now(),
        toolCallId,
        output: result.output,
        printOutput: [...result.printOutput],
        toolCallCount: result.toolCallCount,
        isError: false
    });
    return result;
}

async function rlmSnapshotIdResolve(
    context: ToolExecutionContext,
    at: number,
    snapshotDump: Uint8Array
): Promise<string | null> {
    const config = context.agentSystem?.config?.current;
    const storage = context.agentSystem?.storage;
    const agentId = context.ctx?.agentId;
    if (!config || !storage || typeof agentId !== "string" || agentId.length === 0) {
        return null;
    }
    try {
        return await rlmSnapshotCreate({
            storage,
            config,
            agentId,
            at,
            snapshotDump: rlmSnapshotEncode(snapshotDump)
        });
    } catch {
        return null;
    }
}
