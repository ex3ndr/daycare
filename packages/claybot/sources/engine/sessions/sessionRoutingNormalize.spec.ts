import { describe, expect, it } from "vitest";

import { sessionRoutingNormalize } from "./sessionRoutingNormalize.js";

describe("sessionRoutingNormalize", () => {
  it("returns undefined for invalid values", () => {
    expect(sessionRoutingNormalize(null)).toBeUndefined();
    expect(sessionRoutingNormalize({})).toBeUndefined();
  });

  it("returns a routing object for valid values", () => {
    const result = sessionRoutingNormalize({
      source: "slack",
      context: { channelId: "channel", userId: "user" }
    });

    expect(result).toEqual({
      source: "slack",
      context: { channelId: "channel", userId: "user" }
    });
  });
});
