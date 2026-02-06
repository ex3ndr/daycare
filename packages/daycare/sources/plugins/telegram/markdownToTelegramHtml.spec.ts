import { describe, it, expect } from "vitest";
import { markdownToTelegramHtml } from "./markdownToTelegramHtml.js";

describe("markdownToTelegramHtml", () => {
  it("escapes HTML entities in plain text", () => {
    const result = markdownToTelegramHtml("Use <script> & <style> tags");
    expect(result).toContain("&lt;script&gt;");
    expect(result).toContain("&amp;");
    expect(result).toContain("&lt;style&gt;");
  });

  it("converts bold text", () => {
    const result = markdownToTelegramHtml("This is **bold** text");
    expect(result).toContain("<b>bold</b>");
  });

  it("converts italic text", () => {
    const result = markdownToTelegramHtml("This is *italic* text");
    expect(result).toContain("<i>italic</i>");
  });

  it("converts strikethrough text", () => {
    const result = markdownToTelegramHtml("This is ~~deleted~~ text");
    expect(result).toContain("<s>deleted</s>");
  });

  it("converts inline code", () => {
    const result = markdownToTelegramHtml("Use `const x = 1` here");
    expect(result).toContain("<code>const x = 1</code>");
  });

  it("escapes HTML in inline code", () => {
    const result = markdownToTelegramHtml("Use `<div>` tag");
    expect(result).toContain("<code>&lt;div&gt;</code>");
  });

  it("converts code blocks without language", () => {
    const result = markdownToTelegramHtml("```\nconst x = 1;\n```");
    expect(result).toContain("<pre>const x = 1;</pre>");
  });

  it("converts code blocks with language", () => {
    const result = markdownToTelegramHtml("```typescript\nconst x: number = 1;\n```");
    expect(result).toContain('<pre><code class="language-typescript">const x: number = 1;</code></pre>');
  });

  it("escapes HTML in code blocks", () => {
    const result = markdownToTelegramHtml("```html\n<div>test</div>\n```");
    expect(result).toContain("&lt;div&gt;test&lt;/div&gt;");
  });

  it("converts links", () => {
    const result = markdownToTelegramHtml("Visit [Google](https://google.com)");
    expect(result).toContain('<a href="https://google.com">Google</a>');
  });

  it("escapes HTML in link text", () => {
    const result = markdownToTelegramHtml("Click [<here>](https://example.com)");
    expect(result).toContain("&lt;here&gt;");
  });

  it("converts blockquotes", () => {
    const result = markdownToTelegramHtml("> This is a quote");
    expect(result).toContain("<blockquote>This is a quote</blockquote>");
  });

  it("renders headers as bold", () => {
    const result = markdownToTelegramHtml("# Main Title\n## Subtitle");
    expect(result).toContain("<b>Main Title</b>");
    expect(result).toContain("<b>Subtitle</b>");
  });

  it("renders unordered lists with bullets", () => {
    const result = markdownToTelegramHtml("- Item 1\n- Item 2");
    expect(result).toContain("• Item 1");
    expect(result).toContain("• Item 2");
  });

  it("renders ordered lists with numbers", () => {
    const result = markdownToTelegramHtml("1. First\n2. Second");
    expect(result).toContain("1. First");
    expect(result).toContain("2. Second");
  });

  it("renders task lists with checkboxes", () => {
    const result = markdownToTelegramHtml("- [x] Done\n- [ ] Todo");
    expect(result).toContain("☑ Done");
    expect(result).toContain("☐ Todo");
  });

  it("handles nested formatting", () => {
    const result = markdownToTelegramHtml("This is **bold with *italic* inside**");
    expect(result).toContain("<b>bold with <i>italic</i> inside</b>");
  });

  it("renders tables as plain text", () => {
    const md = `
| Header | Value |
|--------|-------|
| A      | 1     |
`;
    const result = markdownToTelegramHtml(md);
    expect(result).toContain("| Header | Value |");
    expect(result).toContain("| A | 1 |");
  });

  it("handles empty input", () => {
    const result = markdownToTelegramHtml("");
    expect(result).toBe("");
  });

  it("handles plain text without formatting", () => {
    const result = markdownToTelegramHtml("Just plain text here.");
    expect(result).toContain("Just plain text here.");
  });
});
