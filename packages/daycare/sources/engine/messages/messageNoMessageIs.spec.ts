import { describe, expect, it } from "vitest";

import { messageNoMessageIs } from "./messageNoMessageIs.js";

describe("messageNoMessageIs", () => {
  it("returns true for the raw sentinel", () => {
    expect(messageNoMessageIs("NO_MESSAGE")).toBe(true);
  });

  it("trims whitespace and punctuation", () => {
    expect(messageNoMessageIs("  NO_MESSAGE  ")).toBe(true);
    expect(messageNoMessageIs("NO_MESSAGE.")).toBe(true);
  });

  it("accepts wrapped variants", () => {
    expect(messageNoMessageIs("`NO_MESSAGE`")).toBe(true);
    expect(messageNoMessageIs("\"NO_MESSAGE\"")).toBe(true);
    expect(messageNoMessageIs("```text\nNO_MESSAGE\n```")).toBe(true);
  });

  it("rejects extra content", () => {
    expect(messageNoMessageIs("NO_MESSAGE please")).toBe(false);
    expect(messageNoMessageIs("no_message")).toBe(false);
    expect(messageNoMessageIs(null)).toBe(false);
  });
});
