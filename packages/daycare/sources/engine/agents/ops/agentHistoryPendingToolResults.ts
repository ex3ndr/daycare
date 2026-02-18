import type { ToolResultMessage } from "@mariozechner/pi-ai";
import { toolExecutionResultOutcome, toolReturnOutcome } from "../../modules/tools/toolReturnOutcome.js";

import type { AgentHistoryRecord, ToolExecutionResult } from "@/types";

export type AgentHistoryPendingReason = "session_crashed" | "user_aborted";

type PendingToolCall = {
  id: string;
  name: string;
};

/**
 * Builds synthetic tool_result records for unfinished tool calls.
 * Expects: records are ordered chronologically from oldest to newest.
 */
export function agentHistoryPendingToolResults(
  records: AgentHistoryRecord[],
  reason: AgentHistoryPendingReason,
  at: number
): AgentHistoryRecord[] {
  const pendingCalls = agentHistoryPendingToolCallsResolve(records);
  const messageText =
    reason === "session_crashed"
      ? "Session crashed before tool completion."
      : "User aborted before tool completion.";

  return pendingCalls.map((toolCall, index) => ({
    type: "tool_result",
    at: at + index,
    toolCallId: toolCall.id,
    output: toolExecutionResultBuild(toolCall, messageText, at + index)
  }));
}

function agentHistoryPendingToolCallsResolve(records: AgentHistoryRecord[]): PendingToolCall[] {
  const pending = new Map<string, PendingToolCall>();
  for (const record of records) {
    if (record.type === "assistant_message") {
      for (const toolCall of record.toolCalls) {
        const parsed = toolCallSafeParse(toolCall);
        if (!parsed) {
          continue;
        }
        pending.set(parsed.id, parsed);
      }
      continue;
    }
    if (record.type === "tool_result") {
      pending.delete(record.toolCallId);
    }
  }
  return [...pending.values()];
}

function toolCallSafeParse(value: unknown): PendingToolCall | null {
  if (!value || typeof value !== "object") {
    return null;
  }
  const record = value as { id?: unknown; name?: unknown };
  if (typeof record.id !== "string" || record.id.trim().length === 0) {
    return null;
  }
  if (typeof record.name !== "string" || record.name.trim().length === 0) {
    return null;
  }
  return { id: record.id, name: record.name };
}

function toolExecutionResultBuild(
  toolCall: PendingToolCall,
  messageText: string,
  at: number
): ToolExecutionResult {
  const toolMessage: ToolResultMessage = {
    role: "toolResult",
    toolCallId: toolCall.id,
    toolName: toolCall.name,
    content: [{ type: "text", text: messageText }],
    isError: true,
    timestamp: at
  };
  return toolExecutionResultOutcome(toolMessage);
}
