import type { ToolResultMessage } from "@mariozechner/pi-ai";

import type { ToolExecutionResult } from "@/types";

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

  return { toolMessage };
}
