import { describe, expect, it } from "vitest";

import { sessionAgentNormalize } from "./sessionAgentNormalize.js";

describe("sessionAgentNormalize", () => {
  it("returns undefined for invalid values", () => {
    expect(sessionAgentNormalize(null)).toBeUndefined();
    expect(sessionAgentNormalize({ kind: "user" })).toBeUndefined();
  });

  it("returns a background agent state when valid", () => {
    const result = sessionAgentNormalize({
      kind: "background",
      parentSessionId: "parent",
      name: "agent"
    });

    expect(result).toEqual({
      kind: "background",
      parentSessionId: "parent",
      name: "agent"
    });
  });
});
