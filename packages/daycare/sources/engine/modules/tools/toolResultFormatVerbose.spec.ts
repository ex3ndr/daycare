import { describe, expect, it } from "vitest";

import { toolResultFormatVerbose } from "./toolResultFormatVerbose.js";
import type { ToolExecutionResult } from "@/types";

const baseToolMessage = {
  role: "toolResult" as const,
  toolCallId: "tool-1",
  toolName: "do_thing",
  content: [{ type: "text" as const, text: "ok" }],
  isError: false,
  timestamp: Date.now()
};

describe("toolResultFormatVerbose", () => {
  it("formats success results", () => {
    const result: ToolExecutionResult = {
      toolMessage: baseToolMessage
    };

    const text = toolResultFormatVerbose(result);
    expect(text).toContain("[result]");
  });

  it("formats error results", () => {
    const result: ToolExecutionResult = {
      toolMessage: { ...baseToolMessage, isError: true }
    };

    const text = toolResultFormatVerbose(result);
    expect(text).toContain("[error]");
  });
});
