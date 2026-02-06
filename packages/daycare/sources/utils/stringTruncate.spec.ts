import { describe, expect, it } from "vitest";

import { stringTruncate } from "./stringTruncate.js";

describe("stringTruncate", () => {
  it("returns the original string when within limits", () => {
    expect(stringTruncate("hello", 5)).toBe("hello");
    expect(stringTruncate("hello", 10)).toBe("hello");
  });

  it("truncates and appends ellipsis when over limit", () => {
    expect(stringTruncate("hello world", 5)).toBe("hello...");
  });
});
