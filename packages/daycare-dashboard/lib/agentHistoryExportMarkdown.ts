import type { AgentHistoryRecord, AssistantContentBlock, SessionSummary } from "@/lib/engine-client";

type AgentHistoryExportMarkdownInput = {
  agentId: string;
  session: SessionSummary | null;
  records: AgentHistoryRecord[];
};

/**
 * Builds a readable Markdown export for a session history snapshot.
 * Expects records to be pre-sorted by caller in chronological order.
 */
export function agentHistoryExportMarkdown(input: AgentHistoryExportMarkdownInput): string {
  const lines: string[] = [];

  lines.push("# Daycare Session History");
  lines.push("");
  lines.push(`- Agent: \`${input.agentId}\``);
  if (input.session) {
    lines.push(`- Session: \`${input.session.id}\``);
    lines.push(`- Session started: ${timestampFormat(input.session.createdAt)}`);
    lines.push(`- Session ended: ${input.session.endedAt ? timestampFormat(input.session.endedAt) : "active"}`);
  } else {
    lines.push("- Session: latest loaded records");
  }
  lines.push(`- Exported at: ${timestampFormat(Date.now())}`);
  lines.push(`- Record count: ${input.records.length}`);
  lines.push("");

  if (!input.records.length) {
    lines.push("_No records captured._");
    return lines.join("\n");
  }

  lines.push("## Events");
  lines.push("");
  for (const [index, record] of input.records.entries()) {
    lines.push(`### ${index + 1}. ${recordTypeLabel(record)}`);
    lines.push(`- Time: ${timestampFormat(record.at)}`);
    lines.push(`- Type: \`${record.type}\``);
    lines.push(`- Summary: ${recordSummaryBuild(record)}`);
    lines.push("");
    lines.push("```json");
    lines.push(jsonPretty(record));
    lines.push("```");
    lines.push("");
  }

  return lines.join("\n");
}

function timestampFormat(timestamp: number): string {
  if (!Number.isFinite(timestamp)) {
    return "Unknown";
  }
  return new Date(timestamp).toISOString();
}

function recordTypeLabel(record: AgentHistoryRecord): string {
  switch (record.type) {
    case "start":
      return "Agent started";
    case "reset":
      return "Agent reset";
    case "user_message":
      return "User message";
    case "assistant_message":
      return "Assistant message";
    case "tool_result":
      return "Tool result";
    case "rlm_start":
      return "RLM start";
    case "rlm_tool_call":
      return "RLM tool call";
    case "rlm_tool_result":
      return "RLM tool result";
    case "rlm_complete":
      return "RLM complete";
    case "assistant_rewrite":
      return "Assistant rewrite";
    case "note":
      return "Note";
    default:
      return "Event";
  }
}

function recordSummaryBuild(record: AgentHistoryRecord): string {
  switch (record.type) {
    case "start":
      return "Agent lifecycle started.";
    case "reset":
      return record.message ? textTruncate(record.message, 160) : "Agent reset without explicit reason.";
    case "user_message":
      if (record.text) {
        return textTruncate(record.text, 160);
      }
      return record.files.length ? `Message included ${record.files.length} file(s).` : "User message with no text.";
    case "assistant_message": {
      const blocks = Array.isArray(record.content) ? (record.content as AssistantContentBlock[]) : [];
      const text = blocks
        .filter((b): b is Extract<AssistantContentBlock, { type: "text" }> => b.type === "text")
        .map((b) => b.text)
        .join("\n")
        .trim();
      const toolCalls = blocks.filter((b) => b.type === "toolCall");
      if (text) {
        return textTruncate(text, 160);
      }
      if (toolCalls.length) {
        return `Assistant response included ${toolCalls.length} tool call(s).`;
      }
      return "Assistant message with no text.";
    }
    case "tool_result":
      return `Tool call ${record.toolCallId} completed with ${record.output.files.length} file(s).`;
    case "rlm_start":
      return `RLM started for tool call ${record.toolCallId}.`;
    case "rlm_tool_call":
      return `RLM invoked ${record.toolName} (call #${record.toolCallCount + 1}).`;
    case "rlm_tool_result":
      return record.toolIsError
        ? `${record.toolName} returned an error.`
        : `${record.toolName} returned successfully.`;
    case "rlm_complete":
      return record.isError ? textTruncate(record.error ?? "RLM execution failed.", 160) : textTruncate(record.output, 160);
    case "assistant_rewrite":
      return `Assistant rewrite due to ${record.reason}.`;
    case "note":
      return textTruncate(record.text, 160);
    default:
      return "Recorded agent event.";
  }
}

function jsonPretty(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch (error) {
    return error instanceof Error ? error.message : String(value);
  }
}

function textTruncate(text: string, maxLength: number): string {
  if (text.length <= maxLength) {
    return text;
  }
  return `${text.slice(0, maxLength - 3)}...`;
}
