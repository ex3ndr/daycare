import { describe, expect, it } from "vitest";

import { telegramMessageSplit } from "./telegramMessageSplit.js";

describe("telegramMessageSplit", () => {
  it("returns the input when within the limit", () => {
    expect(telegramMessageSplit("hello", 10)).toEqual(["hello"]);
  });

  it("splits on paragraph boundaries when possible", () => {
    const text = "first paragraph\n\nsecond paragraph";
    expect(telegramMessageSplit(text, 18)).toEqual(["first paragraph\n\n", "second paragraph"]);
  });

  it("falls back to hard splits for long tokens", () => {
    const text = "abcdefghij";
    expect(telegramMessageSplit(text, 4)).toEqual(["abcd", "efgh", "ij"]);
  });
});
