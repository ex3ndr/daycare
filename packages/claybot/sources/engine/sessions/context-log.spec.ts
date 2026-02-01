import { describe, expect, it } from "vitest";

import type { Context, Usage } from "@mariozechner/pi-ai";

import { restoreContextMessages, serializeContextMessages } from "./context-log.js";

const baseUsage: Usage = {
  input: 10,
  output: 5,
  cacheRead: 0,
  cacheWrite: 0,
  totalTokens: 15,
  cost: {
    input: 0,
    output: 0,
    cacheRead: 0,
    cacheWrite: 0,
    total: 0
  }
};

describe("context-log", () => {
  it("round-trips context messages", () => {
    const messages: Context["messages"] = [
      {
        role: "user",
        content: "Hello",
        timestamp: 1
      },
      {
        role: "user",
        content: [
          { type: "text", text: "See this" },
          { type: "image", data: "data", mimeType: "image/png" }
        ],
        timestamp: 2
      },
      {
        role: "assistant",
        content: [
          { type: "text", text: "Let me check" },
          { type: "thinking", thinking: "Thinking..." },
          {
            type: "toolCall",
            id: "tool-1",
            name: "lookup",
            arguments: { query: "claybot" }
          }
        ],
        api: "openai-completions",
        provider: "openai",
        model: "gpt-4o",
        usage: baseUsage,
        stopReason: "toolUse",
        timestamp: 3
      },
      {
        role: "toolResult",
        toolCallId: "tool-1",
        toolName: "lookup",
        content: [
          { type: "text", text: "Result" },
          { type: "image", data: "image-data", mimeType: "image/jpeg" }
        ],
        details: { ok: true },
        isError: false,
        timestamp: 4
      }
    ];

    const serialized = serializeContextMessages(messages);
    const restored = restoreContextMessages(serialized);

    expect(restored).toEqual(messages);
  });

  it("does not share references with the original messages", () => {
    const messages: Context["messages"] = [
      { role: "user", content: "Original", timestamp: 1 }
    ];

    const serialized = serializeContextMessages(messages);
    (serialized[0] as { content?: string }).content = "Mutated";

    expect(messages[0]?.content).toBe("Original");
  });
});
