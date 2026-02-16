import { describe, it, expect } from "vitest";
import { tagExtract, tagStrip } from "./tagExtract.js";

describe("tagExtract", () => {
  it("extracts basic content", () => {
    expect(tagExtract("<response>hello</response>", "response")).toBe("hello");
  });

  it("returns null when open tag is missing", () => {
    expect(tagExtract("hello</response>", "response")).toBeNull();
  });

  it("returns null when close tag is missing", () => {
    expect(tagExtract("<response>hello", "response")).toBeNull();
  });

  it("returns empty string for empty content", () => {
    expect(tagExtract("<response></response>", "response")).toBe("");
  });

  it("handles case-insensitive tags", () => {
    expect(tagExtract("<Response>hello</Response>", "response")).toBe("hello");
    expect(tagExtract("<RESPONSE>hello</RESPONSE>", "response")).toBe("hello");
    expect(tagExtract("<rEsPoNsE>hello</rEsPoNsE>", "response")).toBe("hello");
  });

  it("handles mixed-case open and close", () => {
    expect(tagExtract("<Response>hello</response>", "response")).toBe("hello");
    expect(tagExtract("<response>hello</RESPONSE>", "response")).toBe("hello");
  });

  it("handles tags with attributes", () => {
    expect(tagExtract('<response foo="bar">content</response>', "response")).toBe("content");
    expect(tagExtract('<response type="final" id="1">content</response>', "response")).toBe(
      "content"
    );
  });

  it("preserves inner tags unmodified", () => {
    expect(tagExtract("<response>has <inner> tags</response>", "response")).toBe(
      "has <inner> tags"
    );
  });

  it("uses first open and last close for multiple occurrences", () => {
    const text = "<response>outer <response>inner</response> middle</response> end";
    expect(tagExtract(text, "response")).toBe(
      "outer <response>inner</response> middle"
    );
  });

  it("preserves multiline content", () => {
    const text = "<response>\nline 1\nline 2\nline 3\n</response>";
    expect(tagExtract(text, "response")).toBe("line 1\nline 2\nline 3");
  });

  it("trims leading and trailing whitespace only", () => {
    expect(tagExtract("<response>  hello world  </response>", "response")).toBe("hello world");
  });

  it("preserves internal whitespace", () => {
    expect(tagExtract("<response>hello   world</response>", "response")).toBe("hello   world");
  });

  it("handles text before and after the tag block", () => {
    expect(tagExtract("prefix <response>content</response> suffix", "response")).toBe("content");
  });

  it("works with different tag names", () => {
    expect(tagExtract("<result>data</result>", "result")).toBe("data");
    expect(tagExtract("<output>data</output>", "output")).toBe("data");
    expect(tagExtract("<answer>data</answer>", "answer")).toBe("data");
  });

  it("returns null when close tag appears before open tag content start", () => {
    expect(tagExtract("</response><response>hello", "response")).toBeNull();
  });

  it("handles whitespace in close tag", () => {
    expect(tagExtract("<response>hello</response >", "response")).toBe("hello");
    expect(tagExtract("<response>hello</ response>", "response")).toBeNull();
  });
});

describe("tagStrip", () => {
  it("removes the tag block from text", () => {
    expect(tagStrip("prefix <response>content</response> suffix", "response")).toBe(
      "prefix  suffix"
    );
  });

  it("returns text unchanged when no tag found", () => {
    const text = "no tags here";
    expect(tagStrip(text, "response")).toBe(text);
  });

  it("handles tag at start of text", () => {
    expect(tagStrip("<response>content</response> suffix", "response")).toBe(" suffix");
  });

  it("handles tag at end of text", () => {
    expect(tagStrip("prefix <response>content</response>", "response")).toBe("prefix ");
  });

  it("removes entire text when tag is the whole text", () => {
    expect(tagStrip("<response>content</response>", "response")).toBe("");
  });

  it("uses first open and last close", () => {
    expect(
      tagStrip("before <response>a</response> mid <response>b</response> after", "response")
    ).toBe("before  after");
  });

  it("handles case-insensitive tags", () => {
    expect(tagStrip("x<Response>y</Response>z", "response")).toBe("xz");
  });

  it("returns text when only open tag present", () => {
    expect(tagStrip("<response>hello", "response")).toBe("<response>hello");
  });

  it("returns text when only close tag present", () => {
    expect(tagStrip("hello</response>", "response")).toBe("hello</response>");
  });
});
