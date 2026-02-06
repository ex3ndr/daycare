import { describe, it, expect } from "vitest";
import { markdownParse } from "./markdownParse.js";

describe("markdownParse", () => {
  it("parses headings with correct depth", () => {
    const md = `# Title
## Subtitle
### Section`;
    const result = markdownParse(md);

    expect(result.headings).toEqual([
      { depth: 1, text: "Title" },
      { depth: 2, text: "Subtitle" },
      { depth: 3, text: "Section" },
    ]);
  });

  it("extracts code blocks with language", () => {
    const md = `
\`\`\`typescript
const x = 1;
\`\`\`

\`\`\`
plain code
\`\`\`
`;
    const result = markdownParse(md);

    expect(result.codeBlocks).toEqual([
      { lang: "typescript", text: "const x = 1;" },
      { lang: undefined, text: "plain code" },
    ]);
  });

  it("extracts links", () => {
    const md = `Check out [Google](https://google.com) and [GitHub](https://github.com)`;
    const result = markdownParse(md);

    expect(result.links).toEqual([
      { href: "https://google.com", text: "Google" },
      { href: "https://github.com", text: "GitHub" },
    ]);
  });

  it("extracts plain text", () => {
    const md = `# Hello

This is **bold** and _italic_ text.

\`code\` too.`;
    const result = markdownParse(md);

    expect(result.plainText).toContain("Hello");
    expect(result.plainText).toContain("bold");
    expect(result.plainText).toContain("italic");
  });

  it("handles GFM tables", () => {
    const md = `
| Header | Value |
|--------|-------|
| A      | 1     |
`;
    const result = markdownParse(md);

    // Verify tokens contain a table
    const hasTable = result.tokens.some((t) => t.type === "table");
    expect(hasTable).toBe(true);
  });

  it("handles GFM strikethrough", () => {
    const md = `This is ~~deleted~~ text`;
    const result = markdownParse(md);

    expect(result.tokens.length).toBeGreaterThan(0);
  });

  it("handles GFM task lists", () => {
    const md = `
- [x] Done
- [ ] Todo
`;
    const result = markdownParse(md);

    const list = result.tokens.find((t) => t.type === "list");
    expect(list).toBeDefined();
  });
});
