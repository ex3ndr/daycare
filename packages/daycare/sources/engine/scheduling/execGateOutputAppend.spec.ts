import { describe, it, expect } from "vitest";

import { execGateOutputAppend } from "./execGateOutputAppend.js";

describe("execGateOutputAppend", () => {
  it("returns prompt when output is empty", () => {
    const prompt = "Do work.";
    const result = execGateOutputAppend(prompt, {
      shouldRun: true,
      exitCode: 0,
      stdout: "   ",
      stderr: ""
    });
    expect(result).toBe(prompt);
  });

  it("appends trimmed stdout/stderr", () => {
    const result = execGateOutputAppend("Check status", {
      shouldRun: true,
      exitCode: 0,
      stdout: " ok \n",
      stderr: " warn "
    });
    expect(result).toBe("Check status\n\n[Gate output]\nok\nwarn");
  });
});
