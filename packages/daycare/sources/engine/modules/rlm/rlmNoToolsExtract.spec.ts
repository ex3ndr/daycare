import { describe, expect, it } from "vitest";

import { rlmNoToolsExtract } from "./rlmNoToolsExtract.js";

describe("rlmNoToolsExtract", () => {
  it("extracts code from run_python tags", () => {
    const extracted = rlmNoToolsExtract("before <run_python>print('hi')</run_python> after");
    expect(extracted).toBe("print('hi')");
  });

  it("returns null when run_python tags are missing", () => {
    expect(rlmNoToolsExtract("plain text")).toBeNull();
  });

  it("returns null for partial run_python tags", () => {
    expect(rlmNoToolsExtract("<run_python>print('hi')")).toBeNull();
    expect(rlmNoToolsExtract("print('hi')</run_python>")).toBeNull();
  });
});
