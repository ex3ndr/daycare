import { describe, expect, it } from "vitest";

import { sessionRoutingSanitize } from "./sessionRoutingSanitize.js";

describe("sessionRoutingSanitize", () => {
  it("removes message ids and commands from routing context", () => {
    const result = sessionRoutingSanitize({
      channelId: "channel",
      userId: "user",
      messageId: "msg-1",
      commands: [{ name: "help", raw: "/help" }]
    });

    expect(result).toEqual({ channelId: "channel", userId: "user" });
  });
});
