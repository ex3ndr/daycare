import { describe, expect, it } from "vitest";

import { rlmNoToolsModeIs } from "./rlmNoToolsModeIs.js";

describe("rlmNoToolsModeIs", () => {
  it("requires noTools, rlm, and say to all be enabled", () => {
    expect(rlmNoToolsModeIs({ noTools: false, rlm: true, say: true })).toBe(false);
    expect(rlmNoToolsModeIs({ noTools: true, rlm: false, say: true })).toBe(false);
    expect(rlmNoToolsModeIs({ noTools: true, rlm: true, say: false })).toBe(false);
    expect(rlmNoToolsModeIs({ noTools: true, rlm: true, say: true })).toBe(true);
  });
});
