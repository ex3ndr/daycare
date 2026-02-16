import type { ToolResultMessage } from "@mariozechner/pi-ai";
import { MontyRuntimeError, MontySyntaxError } from "@pydantic/monty";
import { Type, type Static } from "@sinclair/typebox";

import type { ToolDefinition, ToolExecutionResult } from "@/types";
import type { ToolResolverApi } from "../toolResolver.js";
import { rlmExecute } from "./rlmExecute.js";
import { RLM_TOOL_NAME } from "./rlmConstants.js";
import { rlmPreambleBuild } from "./rlmPreambleBuild.js";

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
    execute: async (args, context, toolCall) => {
      const payload = args as RlmArgs;
      const runtimeResolver = context.toolResolver ?? toolResolver;
      const preamble = rlmPreambleBuild(runtimeResolver.listTools());

      try {
        const result = await rlmExecute(payload.code, preamble, context, runtimeResolver);
        return buildResult(
          toolCall,
          [
            "Python execution completed.",
            `Tool calls: ${result.toolCallCount}`,
            result.printOutput.length > 0
              ? `Print output:\n${result.printOutput.join("\n")}`
              : "Print output: (none)",
            `Output:\n${result.output.length > 0 ? result.output : "(empty)"}`
          ].join("\n\n"),
          false
        );
      } catch (error) {
        if (error instanceof MontySyntaxError) {
          return buildResult(
            toolCall,
            [
              "Python syntax error. Fix the code and retry.",
              error.display("type-msg")
            ].join("\n\n"),
            true
          );
        }
        if (error instanceof MontyRuntimeError) {
          return buildResult(
            toolCall,
            [
              "Python runtime error.",
              error.display("traceback")
            ].join("\n\n"),
            true
          );
        }

        const message = error instanceof Error ? error.message : String(error);
        return buildResult(toolCall, `Python execution failed: ${message}`, true);
      }
    }
  };
}

function buildResult(
  toolCall: { id: string; name: string },
  text: string,
  isError: boolean
): ToolExecutionResult {
  const toolMessage: ToolResultMessage = {
    role: "toolResult",
    toolCallId: toolCall.id,
    toolName: toolCall.name,
    content: [{ type: "text", text }],
    isError,
    timestamp: Date.now()
  };

  return {
    toolMessage,
    files: []
  };
}
