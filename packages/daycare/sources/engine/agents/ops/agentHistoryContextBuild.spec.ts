import type { ToolCall } from "@mariozechner/pi-ai";
import { describe, expect, it } from "vitest";

import type { AgentHistoryRecord } from "@/types";
import { agentHistoryContextBuild } from "./agentHistoryContextBuild.js";

describe("agentHistoryContextBuild", () => {
  it("skips RLM checkpoint records while rebuilding context messages", async () => {
    const toolCall: ToolCall = {
      type: "toolCall",
      id: "run-python-1",
      name: "run_python",
      arguments: { code: "echo('x')" }
    };
    const records: AgentHistoryRecord[] = [
      { type: "start", at: 1 },
      { type: "reset", at: 2, message: "session reset" },
      { type: "user_message", at: 3, text: "run", files: [] },
      {
        type: "assistant_message",
        at: 4,
        text: "",
        files: [],
        toolCalls: [toolCall],
        tokens: null
      },
      {
        type: "rlm_start",
        at: 5,
        toolCallId: "run-python-1",
        code: "echo('x')",
        preamble: "..."
      },
      {
        type: "rlm_tool_call",
        at: 6,
        toolCallId: "run-python-1",
        snapshot: "AQID",
        printOutput: [],
        toolCallCount: 0,
        toolName: "echo",
        toolArgs: { text: "x" }
      },
      {
        type: "rlm_tool_result",
        at: 7,
        toolCallId: "run-python-1",
        toolName: "echo",
        toolResult: "x",
        toolIsError: false
      },
      {
        type: "rlm_complete",
        at: 8,
        toolCallId: "run-python-1",
        output: "x",
        printOutput: [],
        toolCallCount: 1,
        isError: false
      },
      {
        type: "tool_result",
        at: 9,
        toolCallId: "run-python-1",
        output: {
          toolMessage: {
            role: "toolResult",
            toolCallId: "run-python-1",
            toolName: "run_python",
            content: [{ type: "text", text: "Python execution completed." }],
            isError: false,
            timestamp: 9
          }
        }
      }
    ];

    const messages = await agentHistoryContextBuild(records, "agent-1");

    expect(messages).toHaveLength(4);
    expect(messages[1]?.role).toBe("user");
    expect(messages[2]?.role).toBe("assistant");
    expect(messages[3]?.role).toBe("toolResult");
  });
});
