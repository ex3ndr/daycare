import { type Static, Type } from "@sinclair/typebox";
import type { ToolDefinition, ToolExecutionContext } from "@/types";
import { montyPreambleBuild } from "../monty/montyPreambleBuild.js";
import { RLM_TOOL_NAME } from "../rlm/rlmConstants.js";
import { rlmErrorTextBuild } from "../rlm/rlmErrorTextBuild.js";
import { rlmExecute } from "../rlm/rlmExecute.js";
import { rlmHistoryCompleteErrorRecordBuild } from "../rlm/rlmHistoryCompleteErrorRecordBuild.js";
import { rlmResultTextBuild } from "../rlm/rlmResultTextBuild.js";
import { rlmToolResultBuild, rlmToolReturns } from "../rlm/rlmToolResultBuild.js";

const schema = Type.Object(
    {
        code: Type.String({ minLength: 1 })
    },
    { additionalProperties: false }
);

type RunPythonArgs = Static<typeof schema>;

/**
 * Executes Python code in the Monty runtime and returns a summarized execution result.
 * Expects: toolContext.toolResolver is set so runtime function dispatch can call tools.
 */
export function runPythonTool(): ToolDefinition<typeof schema> {
    return {
        tool: {
            name: RLM_TOOL_NAME,
            description: "Execute Python code in the Daycare runtime and return the execution summary.",
            parameters: schema
        },
        returns: rlmToolReturns,
        execute: async (args, toolContext, toolCall) => {
            const payload = args as RunPythonArgs;
            const code = payload.code.trim();
            if (!code) {
                throw new Error("code is required.");
            }
            const toolResolver = toolContext.toolResolver;
            if (!toolResolver) {
                throw new Error("run_python requires tool resolver context.");
            }

            const availableTools = toolResolver.listToolsForAgent({
                ctx: toolContext.ctx,
                descriptor: toolContext.agent.descriptor
            });
            const preamble = montyPreambleBuild(availableTools);

            try {
                const result = await rlmExecute(
                    code,
                    preamble,
                    { ...toolContext, pythonExecution: true },
                    toolResolver,
                    toolCall.id,
                    toolContext.appendHistoryRecord,
                    () => steeringInfoResolve(toolContext)
                );
                const toolResult = rlmToolResultBuild(toolCall, rlmResultTextBuild(result), false);
                if (result.skipTurn) {
                    return { ...toolResult, skipTurn: true };
                }
                return toolResult;
            } catch (error) {
                if (abortErrorIs(error, toolContext.abortSignal)) {
                    throw error;
                }
                const errorMessage = error instanceof Error ? error.message : String(error);
                await toolContext.appendHistoryRecord?.(
                    rlmHistoryCompleteErrorRecordBuild(toolCall.id, errorMessage, [], 0)
                );
                return rlmToolResultBuild(toolCall, rlmErrorTextBuild(error), true);
            }
        }
    };
}

function steeringInfoResolve(toolContext: Pick<ToolExecutionContext, "agent">): {
    text: string;
    origin?: string;
} | null {
    const steering = toolContext.agent.inbox.consumeSteering();
    if (!steering) {
        return null;
    }
    return {
        text: steering.text,
        origin: steering.origin
    };
}

function abortErrorIs(error: unknown, signal?: AbortSignal): boolean {
    if (signal?.aborted) {
        return true;
    }
    if (error instanceof Error && error.name === "AbortError") {
        return true;
    }
    if (typeof error !== "object" || error === null) {
        return false;
    }
    return (error as { name?: unknown }).name === "AbortError";
}
