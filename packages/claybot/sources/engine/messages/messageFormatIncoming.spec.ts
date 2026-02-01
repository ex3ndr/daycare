import { describe, expect, it } from "vitest";

import { messageFormatIncoming } from "./messageFormatIncoming.js";

describe("messageFormatIncoming", () => {
  it("wraps message text with time and ids", () => {
    const message = { text: "hello" };
    const context = { channelId: "channel", userId: "user", messageId: "msg-1" };
    const result = messageFormatIncoming(message, context, new Date("2024-01-01T00:00:00Z"));

    expect(result.rawText).toBe("hello");
    expect(result.text).toContain("<time>");
    expect(result.text).toContain("<message_id>msg-1</message_id>");
    expect(result.text).toContain("<message>hello</message>");
  });

  it("returns the message when no text or files", () => {
    const message = { text: null, files: [] };
    const context = { channelId: "channel", userId: "user" };
    const result = messageFormatIncoming(message, context, new Date());

    expect(result).toEqual(message);
  });
});
