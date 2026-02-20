import { describe, expect, it } from "vitest";
import { markdownToWhatsAppText } from "./markdownToWhatsAppText.js";

describe("markdownToWhatsAppText", () => {
    it("converts bold text", () => {
        const result = markdownToWhatsAppText("This is **bold** text");
        expect(result).toContain("*bold*");
    });

    it("converts italic text", () => {
        const result = markdownToWhatsAppText("This is *italic* text");
        expect(result).toContain("_italic_");
    });

    it("converts strikethrough text", () => {
        const result = markdownToWhatsAppText("This is ~~deleted~~ text");
        expect(result).toContain("~deleted~");
    });

    it("converts inline code to triple backticks", () => {
        const result = markdownToWhatsAppText("Use `const x = 1` here");
        expect(result).toContain("```const x = 1```");
    });

    it("converts code blocks", () => {
        const result = markdownToWhatsAppText("```\nconst x = 1;\n```");
        expect(result).toContain("```const x = 1;```");
    });

    it("converts links to text with URL", () => {
        const result = markdownToWhatsAppText("Visit [Google](https://google.com)");
        expect(result).toContain("Google (https://google.com)");
    });

    it("keeps plain URLs as-is", () => {
        const result = markdownToWhatsAppText("[https://example.com](https://example.com)");
        expect(result).toContain("https://example.com");
        expect(result).not.toContain("(https://example.com)");
    });

    it("converts blockquotes with > prefix", () => {
        const result = markdownToWhatsAppText("> This is a quote");
        expect(result).toContain("> This is a quote");
    });

    it("renders headers as bold", () => {
        const result = markdownToWhatsAppText("# Main Title\n## Subtitle");
        expect(result).toContain("*Main Title*");
        expect(result).toContain("*Subtitle*");
    });

    it("renders unordered lists with bullets", () => {
        const result = markdownToWhatsAppText("- Item 1\n- Item 2");
        expect(result).toContain("• Item 1");
        expect(result).toContain("• Item 2");
    });

    it("renders ordered lists with numbers", () => {
        const result = markdownToWhatsAppText("1. First\n2. Second");
        expect(result).toContain("1. First");
        expect(result).toContain("2. Second");
    });

    it("renders task lists with checkboxes", () => {
        const result = markdownToWhatsAppText("- [x] Done\n- [ ] Todo");
        expect(result).toContain("☑ Done");
        expect(result).toContain("☐ Todo");
    });

    it("handles nested formatting", () => {
        const result = markdownToWhatsAppText("This is **bold with *italic* inside**");
        expect(result).toContain("*bold with _italic_ inside*");
    });

    it("renders tables as plain text", () => {
        const md = `
| Header | Value |
|--------|-------|
| A      | 1     |
`;
        const result = markdownToWhatsAppText(md);
        expect(result).toContain("| Header | Value |");
        expect(result).toContain("| A | 1 |");
    });

    it("handles empty input", () => {
        const result = markdownToWhatsAppText("");
        expect(result).toBe("");
    });

    it("handles plain text without formatting", () => {
        const result = markdownToWhatsAppText("Just plain text here.");
        expect(result).toContain("Just plain text here.");
    });
});
