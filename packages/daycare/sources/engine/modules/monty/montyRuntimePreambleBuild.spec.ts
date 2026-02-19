import { describe, expect, it } from "vitest";

import { montyRuntimePreambleBuild } from "./montyRuntimePreambleBuild.js";

describe("montyRuntimePreambleBuild", () => {
  it("renders minimal runtime preamble without prompt guidance text", () => {
    const result = montyRuntimePreambleBuild();
    const expected = [
      "from typing import Any",
      "",
      "ToolError = RuntimeError"
    ].join("\n");
    expect(result).toBe(expected);
    expect(result).not.toContain("if False:");
    expect(result).not.toContain("# You have the following tools");
  });
});
