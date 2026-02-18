import type { ToolResultMessage } from "@mariozechner/pi-ai";
import { Type, type Static } from "@sinclair/typebox";

import type { ToolExecutionResult, ToolResultContract } from "@/types";

export const rlmToolResultSchema = Type.Object(
  {
    summary: Type.String(),
    isError: Type.Boolean()
  },
  { additionalProperties: false }
);

export type RlmToolResult = Static<typeof rlmToolResultSchema>;

export const rlmToolReturns: ToolResultContract<RlmToolResult> = {
  schema: rlmToolResultSchema,
  toLLMText: (result) => result.summary
};

/**
 * Builds a run_python tool execution result using a plain text payload.
 * Expects: toolCall references the outer run_python call id/name.
 */
export function rlmToolResultBuild(
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
    typedResult: {
      summary: text,
      isError
    }
  };
}
