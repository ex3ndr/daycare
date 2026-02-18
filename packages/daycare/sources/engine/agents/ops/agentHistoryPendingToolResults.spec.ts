import type { ToolCall } from "@mariozechner/pi-ai";
import { describe, expect, it } from "vitest";

import type { AgentHistoryRecord } from "@/types";
import { agentHistoryPendingToolResults } from "./agentHistoryPendingToolResults.js";

describe("agentHistoryPendingToolResults", () => {
  it("builds completion records for unfinished calls on session crash", () => {
    const records: AgentHistoryRecord[] = [
      assistantRecordBuild(10, [
        toolCallBuild("tool-1", "read_file"),
        toolCallBuild("tool-2", "write_file")
      ]),
      toolResultRecordBuild(11, "tool-1", "read_file")
    ];

    const completion = agentHistoryPendingToolResults(records, "session_crashed", 50);

    expect(completion).toHaveLength(1);
    expect(completion[0]).toEqual(
      toolResultErrorRecordBuild(50, "tool-2", "write_file", "Session crashed before tool completion.")
    );
  });

  it("builds completion records for unfinished calls on user abort", () => {
    const records: AgentHistoryRecord[] = [
      assistantRecordBuild(10, [toolCallBuild("tool-9", "run_task")])
    ];

    const completion = agentHistoryPendingToolResults(records, "user_aborted", 70);

    expect(completion).toHaveLength(1);
    expect(completion[0]).toEqual(
      toolResultErrorRecordBuild(70, "tool-9", "run_task", "User aborted before tool completion.")
    );
  });

  it("returns an empty array when all calls are completed", () => {
    const records: AgentHistoryRecord[] = [
      assistantRecordBuild(10, [toolCallBuild("tool-1", "read_file")]),
      toolResultRecordBuild(11, "tool-1", "read_file")
    ];

    const completion = agentHistoryPendingToolResults(records, "session_crashed", 90);

    expect(completion).toEqual([]);
  });
});

function assistantRecordBuild(at: number, toolCalls: ToolCall[]): AgentHistoryRecord {
  return {
    type: "assistant_message",
    at,
    text: "",
    files: [],
    toolCalls,
    tokens: null
  };
}

function toolResultRecordBuild(at: number, toolCallId: string, toolName: string): AgentHistoryRecord {
  return {
    type: "tool_result",
    at,
    toolCallId,
    output: {
      toolMessage: {
        role: "toolResult",
        toolCallId,
        toolName,
        content: [{ type: "text", text: "ok" }],
        isError: false,
        timestamp: at
      },
      typedResult: { text: "ok" }
    }
  };
}

function toolResultErrorRecordBuild(
  at: number,
  toolCallId: string,
  toolName: string,
  text: string
): AgentHistoryRecord {
  return {
    type: "tool_result",
    at,
    toolCallId,
    output: {
      toolMessage: {
        role: "toolResult",
        toolCallId,
        toolName,
        content: [{ type: "text", text }],
        isError: true,
        timestamp: at
      },
      typedResult: {
        toolCallId,
        toolName,
        isError: true,
        timestamp: at,
        text
      }
    }
  };
}

function toolCallBuild(id: string, name: string): ToolCall {
  return {
    id,
    name,
    type: "toolCall",
    arguments: {}
  };
}
