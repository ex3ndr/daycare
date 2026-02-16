import { describe, expect, it } from "vitest";

import { shellQuote } from "./shellQuote.js";

describe("shellQuote", () => {
  it("wraps plain text in single quotes", () => {
    expect(shellQuote("hello")).toBe("'hello'");
  });

  it("escapes embedded single quotes for POSIX shells", () => {
    expect(shellQuote("it's fine")).toBe("'it'\"'\"'s fine'");
  });
});
