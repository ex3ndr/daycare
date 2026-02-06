import { describe, expect, it } from "vitest";

import { cuid2Is } from "./cuid2Is.js";

describe("cuid2Is", () => {
  it("returns true for valid cuid2 strings", () => {
    expect(cuid2Is("a".repeat(24))).toBe(true);
    expect(cuid2Is("abc123".repeat(4))).toBe(true);
  });

  it("returns false for invalid values", () => {
    expect(cuid2Is("A".repeat(24))).toBe(false);
    expect(cuid2Is("abc".repeat(5))).toBe(false);
    expect(cuid2Is(null)).toBe(false);
    expect(cuid2Is(undefined)).toBe(false);
  });
});
