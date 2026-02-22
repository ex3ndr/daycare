import { type Static, Type } from "@sinclair/typebox";

import type { ToolDefinition } from "@/types";
import { montyRuntimePreambleBuild } from "../monty/montyRuntimePreambleBuild.js";
import type { ToolResolverApi } from "../toolResolver.js";
import { RLM_TOOL_NAME } from "./rlmConstants.js";
import { rlmErrorTextBuild } from "./rlmErrorTextBuild.js";
import { rlmExecute } from "./rlmExecute.js";
import { rlmHistoryCompleteErrorRecordBuild } from "./rlmHistoryCompleteErrorRecordBuild.js";
import { rlmResultTextBuild } from "./rlmResultTextBuild.js";
import { rlmToolResultBuild, rlmToolReturns } from "./rlmToolResultBuild.js";
import { rlmToolsForContextResolve } from "./rlmToolsForContextResolve.js";

const schema = Type.Object(
    {
        code: Type.String({ minLength: 1 })
    },
    { additionalProperties: false }
);

type RlmArgs = Static<typeof schema>;

/**
 * Builds the run_python tool that executes Monty Python and dispatches calls to registered tools.
 * Expects: toolResolver includes the underlying concrete tools to dispatch.
 */
export function rlmToolBuild(toolResolver: ToolResolverApi): ToolDefinition {
    return {
        tool: {
            name: RLM_TOOL_NAME,
            description:
                "Execute Python code to complete the task. Available function stubs are injected in this tool description at runtime.",
            parameters: schema
        },
        returns: rlmToolReturns,
        execute: async (args, context, toolCall) => {
            const payload = args as RlmArgs;
            const runtimeResolver = context.toolResolver ?? toolResolver;
            const preamble = montyRuntimePreambleBuild(rlmToolsForContextResolve(runtimeResolver, context));
            const appendHistoryRecord = context.appendHistoryRecord;

            try {
                // Create steering check callback that consumes steering if present
                const checkSteering = () => {
                    const steering = context.agent.inbox.consumeSteering();
                    if (steering) {
                        return { text: steering.text, origin: steering.origin };
                    }
                    return null;
                };
                const result = await rlmExecute(
                    payload.code,
                    preamble,
                    context,
                    runtimeResolver,
                    toolCall.id,
                    appendHistoryRecord,
                    checkSteering
                );
                const toolResult = rlmToolResultBuild(toolCall, rlmResultTextBuild(result), false);
                if (result.skipTurn) {
                    toolResult.skipTurn = true;
                }
                return toolResult;
            } catch (error) {
                const message = error instanceof Error ? error.message : String(error);
                await appendHistoryRecord?.(rlmHistoryCompleteErrorRecordBuild(toolCall.id, message));
                return rlmToolResultBuild(toolCall, rlmErrorTextBuild(error), true);
            }
        }
    };
}
