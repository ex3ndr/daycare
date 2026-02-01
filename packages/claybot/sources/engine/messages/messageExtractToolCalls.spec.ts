import type { AssistantMessage, ToolCall, UserMessage } from "@mariozechner/pi-ai";
import { describe, expect, it } from "vitest";

import { messageExtractToolCalls } from "./messageExtractToolCalls.js";

describe("messageExtractToolCalls", () => {
  it("returns tool calls from assistant content", () => {
    const toolCall: ToolCall = {
      id: "tool-1",
      name: "do_thing",
      type: "toolCall",
      arguments: {}
    };
    const message: AssistantMessage = {
      role: "assistant",
      content: [{ type: "text", text: "ok" }, toolCall],
      api: "openai-responses",
      provider: "openai",
      model: "test-model",
      usage: {
        input: 0,
        output: 0,
        cacheRead: 0,
        cacheWrite: 0,
        totalTokens: 0,
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 }
      },
      stopReason: "stop",
      timestamp: Date.now()
    };

    expect(messageExtractToolCalls(message)).toEqual([toolCall]);
  });

  it("returns empty list for non-assistant messages", () => {
    const message: UserMessage = {
      role: "user",
      content: "hello",
      timestamp: Date.now()
    };

    expect(messageExtractToolCalls(message)).toEqual([]);
  });
});
