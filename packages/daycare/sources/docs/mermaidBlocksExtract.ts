export type MermaidBlock = {
  index: number;
  diagram: string;
};

const MERMAID_BLOCK_PATTERN = /```mermaid[^\n]*\n([\s\S]*?)```/g;

/**
 * Extracts Mermaid fenced code blocks from markdown.
 * Expects: markdown content that may include one or more ```mermaid fences.
 */
export function mermaidBlocksExtract(markdown: string): MermaidBlock[] {
  const blocks: MermaidBlock[] = [];

  for (const match of markdown.matchAll(MERMAID_BLOCK_PATTERN)) {
    const rawDiagram = match[1];
    if (typeof rawDiagram !== "string") {
      continue;
    }

    const diagram = rawDiagram.trim();
    if (diagram.length === 0) {
      continue;
    }

    blocks.push({
      index: blocks.length,
      diagram
    });
  }

  return blocks;
}
