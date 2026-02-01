import { describe, it, expect } from "vitest";

import { heartbeatParse } from "./heartbeatParse.js";

describe("heartbeatParse", () => {
  it("uses title from frontmatter", () => {
    const result = heartbeatParse("Some prompt", { title: "My Title" }, "fallback");
    expect(result.title).toBe("My Title");
    expect(result.prompt).toBe("Some prompt");
  });

  it("uses name from frontmatter as title", () => {
    const result = heartbeatParse("Prompt text", { name: "Named Task" }, "fallback");
    expect(result.title).toBe("Named Task");
    expect(result.prompt).toBe("Prompt text");
  });

  it("extracts title from heading when no frontmatter title", () => {
    const body = "# Heading Title\n\nBody content here.";
    const result = heartbeatParse(body, {}, "fallback");
    expect(result.title).toBe("Heading Title");
    expect(result.prompt).toBe("Body content here.");
  });

  it("supports multi-level headings", () => {
    const body = "### Level 3 Heading\n\nContent.";
    const result = heartbeatParse(body, {}, "fallback");
    expect(result.title).toBe("Level 3 Heading");
    expect(result.prompt).toBe("Content.");
  });

  it("uses fallback when no title source available", () => {
    const result = heartbeatParse("Just a prompt", {}, "my-fallback");
    expect(result.title).toBe("my-fallback");
    expect(result.prompt).toBe("Just a prompt");
  });

  it("uses fallback when frontmatter title is empty", () => {
    const result = heartbeatParse("Prompt", { title: "   " }, "fallback");
    expect(result.title).toBe("fallback");
    expect(result.prompt).toBe("Prompt");
  });

  it("trims body content", () => {
    const result = heartbeatParse("  \n  Content  \n  ", { title: "T" }, "fb");
    expect(result.prompt).toBe("Content");
  });

  it("handles empty body", () => {
    const result = heartbeatParse("", { title: "Title" }, "fallback");
    expect(result.title).toBe("Title");
    expect(result.prompt).toBe("");
  });
});
