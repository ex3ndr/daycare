import { describe, expect, it } from "vitest";

import { sessionKeyBuild } from "./sessionKeyBuild.js";

describe("sessionKeyBuild", () => {
  it("builds keys for cron and heartbeat", () => {
    expect(sessionKeyBuild({ type: "cron", id: "task" })).toBe("cron:task");
    expect(sessionKeyBuild({ type: "heartbeat" })).toBe("heartbeat");
  });

  it("builds keys for user descriptors", () => {
    expect(
      sessionKeyBuild({
        type: "user",
        connector: "slack",
        channelId: "channel",
        userId: "user"
      })
    ).toBe("user:slack:channel:user");
  });

  it("returns null for other descriptor types", () => {
    expect(
      sessionKeyBuild({
        type: "subagent",
        id: "session",
        parentSessionId: "parent",
        name: "agent"
      })
    ).toBeNull();
  });
});
