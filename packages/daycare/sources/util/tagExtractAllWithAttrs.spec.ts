import { describe, expect, it } from "vitest";

import { tagExtractAllWithAttrs } from "./tagExtractAllWithAttrs.js";

describe("tagExtractAllWithAttrs", () => {
  it("extracts basic tags with content", () => {
    expect(tagExtractAllWithAttrs("x <file>/tmp/a.txt</file>", "file")).toEqual([
      { content: "/tmp/a.txt", attrs: {} }
    ]);
  });

  it("extracts multiple tags in order", () => {
    const text = "<file>/tmp/a.txt</file> and <file>/tmp/b.txt</file>";
    expect(tagExtractAllWithAttrs(text, "file")).toEqual([
      { content: "/tmp/a.txt", attrs: {} },
      { content: "/tmp/b.txt", attrs: {} }
    ]);
  });

  it("extracts quoted attributes", () => {
    const text = '<file mode="doc" source="tool">/tmp/a.pdf</file>';
    expect(tagExtractAllWithAttrs(text, "file")).toEqual([
      { content: "/tmp/a.pdf", attrs: { mode: "doc", source: "tool" } }
    ]);
  });

  it("supports single-quoted attributes", () => {
    const text = "<file mode='photo'>/tmp/a.png</file>";
    expect(tagExtractAllWithAttrs(text, "file")).toEqual([
      { content: "/tmp/a.png", attrs: { mode: "photo" } }
    ]);
  });

  it("returns attrs as empty object when absent", () => {
    expect(tagExtractAllWithAttrs("<file> a </file>", "file")).toEqual([
      { content: "a", attrs: {} }
    ]);
  });

  it("returns empty array when no matches are found", () => {
    expect(tagExtractAllWithAttrs("no tags", "file")).toEqual([]);
  });

  it("handles mixed content around tags", () => {
    const text = "reasoning <file mode=\"video\"> /tmp/a.mp4 </file> done";
    expect(tagExtractAllWithAttrs(text, "file")).toEqual([
      { content: "/tmp/a.mp4", attrs: { mode: "video" } }
    ]);
  });
});
