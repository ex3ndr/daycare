import { describe, expect, it } from "vitest";

import { mermaidBlocksExtract } from "./mermaidBlocksExtract.js";

describe("mermaidBlocksExtract", () => {
  it("extracts mermaid blocks in order", () => {
    const markdown = [
      "# Docs",
      "",
      "```mermaid",
      "graph LR",
      "  A --> B",
      "```",
      "",
      "```ts",
      "console.log('ignored')",
      "```",
      "",
      "```mermaid",
      "sequenceDiagram",
      "  Alice->>Bob: hi",
      "```"
    ].join("\n");

    const blocks = mermaidBlocksExtract(markdown);

    expect(blocks).toEqual([
      { index: 0, diagram: "graph LR\n  A --> B" },
      { index: 1, diagram: "sequenceDiagram\n  Alice->>Bob: hi" }
    ]);
  });

  it("returns an empty array when no mermaid block exists", () => {
    const blocks = mermaidBlocksExtract("# Docs\n\nNo diagram here.");
    expect(blocks).toEqual([]);
  });
});
