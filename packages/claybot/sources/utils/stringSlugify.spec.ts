import { describe, it, expect } from "vitest";

import { stringSlugify } from "./stringSlugify.js";

describe("stringSlugify", () => {
  it("converts to lowercase", () => {
    expect(stringSlugify("Hello World")).toBe("hello-world");
  });

  it("replaces spaces with hyphens", () => {
    expect(stringSlugify("foo bar baz")).toBe("foo-bar-baz");
  });

  it("removes special characters", () => {
    expect(stringSlugify("Task: Important!")).toBe("task-important");
  });

  it("collapses multiple hyphens", () => {
    expect(stringSlugify("a   b")).toBe("a-b");
  });

  it("trims leading and trailing hyphens", () => {
    expect(stringSlugify("  hello  ")).toBe("hello");
    expect(stringSlugify("---test---")).toBe("test");
  });

  it("handles empty string", () => {
    expect(stringSlugify("")).toBe("");
  });
});
