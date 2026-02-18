import type { ToolResultMessage } from "@mariozechner/pi-ai";
import { Type, type Static } from "@sinclair/typebox";

import type { ToolExecutionResult, ToolResultContract } from "@/types";

export const toolReturnTextSchema = Type.Object(
  {
    text: Type.String()
  },
  { additionalProperties: false }
);

export type ToolReturnText = Static<typeof toolReturnTextSchema>;

export const toolReturnText: ToolResultContract<ToolReturnText> = {
  schema: toolReturnTextSchema,
  toLLMText: (result) => result.text
};

/**
 * Converts a ToolResultMessage into a strongly typed text result payload.
 * Expects: message is produced by a tool execution and may include multiple content blocks.
 */
export function toolExecutionResultText(
  toolMessage: ToolResultMessage
): ToolExecutionResult<ToolReturnText> {
  return {
    toolMessage,
    typedResult: {
      text: toolMessageTextExtract(toolMessage)
    }
  };
}

function toolMessageTextExtract(toolMessage: ToolResultMessage): string {
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
