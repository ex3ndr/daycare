import { Type, type Static } from "@sinclair/typebox";
import { toolExecutionResultText, toolReturnText } from "../tools/toolReturnText.js";

import type { ToolDefinition } from "@/types";
import type { ToolResolverApi } from "../toolResolver.js";
import { rlmExecute } from "./rlmExecute.js";
import { rlmHistoryCompleteErrorRecordBuild } from "./rlmHistoryCompleteErrorRecordBuild.js";
import { RLM_TOOL_NAME } from "./rlmConstants.js";
import { rlmErrorTextBuild } from "./rlmErrorTextBuild.js";
import { rlmPreambleBuild } from "./rlmPreambleBuild.js";
import { rlmResultTextBuild } from "./rlmResultTextBuild.js";
import { rlmToolResultBuild } from "./rlmToolResultBuild.js";

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
    returns: toolReturnText,
    execute: async (args, context, toolCall) => {
      const payload = args as RlmArgs;
      const runtimeResolver = context.toolResolver ?? toolResolver;
      const preamble = rlmPreambleBuild(runtimeResolver.listTools());
      const appendHistoryRecord = context.appendHistoryRecord;

      try {
        const result = await rlmExecute(
          payload.code,
          preamble,
          context,
          runtimeResolver,
          toolCall.id,
          appendHistoryRecord
        );
        return rlmToolResultBuild(toolCall, rlmResultTextBuild(result), false);
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        await appendHistoryRecord?.(rlmHistoryCompleteErrorRecordBuild(toolCall.id, message));
        return rlmToolResultBuild(toolCall, rlmErrorTextBuild(error), true);
      }
    }
  };
}
