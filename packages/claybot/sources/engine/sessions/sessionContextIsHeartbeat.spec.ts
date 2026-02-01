import { describe, expect, it } from "vitest";

import { sessionContextIsHeartbeat } from "./sessionContextIsHeartbeat.js";

describe("sessionContextIsHeartbeat", () => {
  it("returns true for heartbeat context", () => {
    expect(sessionContextIsHeartbeat({ channelId: "c", userId: "u", heartbeat: {} })).toBe(true);
  });

  it("returns true for heartbeat session descriptors", () => {
    expect(sessionContextIsHeartbeat({ channelId: "c", userId: "u" }, { type: "heartbeat" })).toBe(true);
  });
});
