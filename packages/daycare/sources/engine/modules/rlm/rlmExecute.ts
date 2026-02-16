import { Monty, MontyComplete, MontySnapshot } from "@pydantic/monty";
import { createId } from "@paralleldrive/cuid2";

import type { ToolExecutionContext } from "@/types";
import type { ToolResolverApi } from "../toolResolver.js";
import { rlmArgsConvert, rlmResultConvert } from "./rlmConvert.js";
import { RLM_PRINT_FUNCTION_NAME, RLM_TOOL_NAME } from "./rlmConstants.js";

const RLM_LIMITS = {
  maxDurationSecs: 30,
  maxMemory: 50 * 1024 * 1024,
  maxRecursionDepth: 100,
  maxAllocations: 1_000_000
};

export type RlmExecuteResult = {
  output: string;
  printOutput: string[];
  toolCallCount: number;
};

/**
 * Executes Monty Python code by routing external function calls into ToolResolver.
 * Expects: preamble matches the currently available tool names.
 */
export async function rlmExecute(
  code: string,
  preamble: string,
  context: ToolExecutionContext,
  toolResolver: ToolResolverApi
): Promise<RlmExecuteResult> {
  const availableTools = toolResolver
    .listTools()
    .filter((tool) => tool.name !== RLM_TOOL_NAME);
  const toolByName = new Map(availableTools.map((tool) => [tool.name, tool]));
  const externalFunctions = [...toolByName.keys(), RLM_PRINT_FUNCTION_NAME];
  const rewrittenCode = printCallsRewrite(code);
  const script = [preamble.trim(), rewrittenCode].filter((chunk) => chunk.length > 0).join("\n\n");
  const monty = new Monty(script, {
    scriptName: "run_python.py",
    externalFunctions
  });

  const printOutput: string[] = [];
  let toolCallCount = 0;
  let progress: MontySnapshot | MontyComplete = monty.start({ limits: RLM_LIMITS });

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

    toolCallCount += 1;
    let resumeOptions:
      | { returnValue: unknown }
      | { exception: { type: string; message: string } };
    try {
      const args = rlmArgsConvert(progress.args, progress.kwargs, tool);
      const toolResult = await toolResolver.execute(
        {
          type: "toolCall",
          id: createId(),
          name: tool.name,
          arguments: args as Record<string, unknown>
        },
        context
      );
      const value = rlmResultConvert(toolResult);

      if (toolResult.toolMessage.isError) {
        resumeOptions = {
          exception: {
            type: "RuntimeError",
            message:
              typeof value === "string" && value.trim().length > 0
                ? value
                : `Tool execution failed: ${tool.name}`
          }
        };
      } else {
        resumeOptions = { returnValue: value };
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      resumeOptions = {
        exception: {
          type: "RuntimeError",
          message: `ToolError: ${message}`
        }
      };
    }

    progress = progress.resume(resumeOptions);
  }

  return {
    output: valueFormat(progress.output),
    printOutput,
    toolCallCount
  };
}

function printCallsRewrite(code: string): string {
  return code.replace(/(^|[^A-Za-z0-9_])print\s*\(/gm, `$1${RLM_PRINT_FUNCTION_NAME}(`);
}

function printLineBuild(args: unknown[]): string {
  return args.map((entry) => valueFormat(entry)).join(" ").trimEnd();
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
