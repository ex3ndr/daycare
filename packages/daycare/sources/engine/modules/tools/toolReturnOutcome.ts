import type { ToolResultMessage } from "@mariozechner/pi-ai";
import { Type, type Static } from "@sinclair/typebox";

import type {
  ToolExecutionResult,
  ToolResultContract,
  ToolResultShallowObject
} from "@/types";

export const toolReturnOutcomeSchema = Type.Object(
  {
    toolCallId: Type.String(),
    toolName: Type.String(),
    isError: Type.Boolean(),
    timestamp: Type.Number(),
    text: Type.String()
  },
  { additionalProperties: false }
);

export type ToolReturnOutcome = Static<typeof toolReturnOutcomeSchema>;

export const toolReturnOutcome: ToolResultContract<ToolReturnOutcome> = {
  schema: toolReturnOutcomeSchema,
  toLLMText: (result) => result.text
};

/**
 * Builds a strongly typed tool execution payload from a ToolResultMessage.
 * Expects: message content follows the tool text block convention.
 */
export function toolExecutionResultOutcome(
  toolMessage: ToolResultMessage
): ToolExecutionResult<ToolReturnOutcome> {
  return toolExecutionResultOutcomeWithTyped(
    toolMessage,
    {
      toolCallId: toolMessage.toolCallId ?? "",
      toolName: toolMessage.toolName ?? "",
      isError: Boolean(toolMessage.isError),
      timestamp: typeof toolMessage.timestamp === "number" ? toolMessage.timestamp : Date.now(),
      text: toolMessageTextExtract(toolMessage)
    }
  );
}

/**
 * Builds a strongly typed tool execution payload from a ToolResultMessage and structured result object.
 * Expects: typedResult matches the caller-defined return schema.
 */
export function toolExecutionResultOutcomeWithTyped<TResult extends ToolResultShallowObject>(
  toolMessage: ToolResultMessage,
  typedResult: TResult
): ToolExecutionResult<TResult> {
  return {
    toolMessage,
    typedResult
  };
}

export function toolMessageTextExtract(toolMessage: ToolResultMessage): string {
  const content = Array.isArray(toolMessage.content) ? toolMessage.content : [];
  const text = content
    .filter((part) => part?.type === "text" && "text" in part && typeof part.text === "string")
    .map((part) => ("text" in part && typeof part.text === "string" ? part.text : ""))
    .join("\n")
    .trim();
  if (text.length > 0) {
    return text;
  }
  try {
    return JSON.stringify(toolMessage.content);
  } catch {
    return String(toolMessage.content);
  }
}
