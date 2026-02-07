import { promises as fs } from "node:fs";
import path from "node:path";

import { Resvg } from "@resvg/resvg-js";
import { THEMES, renderMermaid } from "beautiful-mermaid";

import { mermaidBlocksExtract } from "./mermaidBlocksExtract.js";

type MermaidThemeName = keyof typeof THEMES;

export type MermaidDocsRenderOptions = {
  docsDir: string;
  outputDir: string;
  themeName?: MermaidThemeName;
  font?: string;
  pngWidth?: number;
  onWrite?: (outputPath: string) => void;
};

export type MermaidDocsRenderResult = {
  markdownFileCount: number;
  diagramCount: number;
};

/**
 * Renders Mermaid blocks from markdown docs to PNG files.
 * Expects: docsDir contains .md files and outputDir is writable.
 */
export async function mermaidDocsRender(
  options: MermaidDocsRenderOptions
): Promise<MermaidDocsRenderResult> {
  const markdownFiles = await markdownFilesList(options.docsDir);
  const themeName = options.themeName ?? "github-light";
  const theme = THEMES[themeName];
  if (!theme) {
    throw new Error(`Unknown Mermaid theme: ${themeName}`);
  }

  await fs.mkdir(options.outputDir, { recursive: true });

  let markdownFileCount = 0;
  let diagramCount = 0;

  for (const markdownFile of markdownFiles) {
    const content = await fs.readFile(markdownFile, "utf8");
    const blocks = mermaidBlocksExtract(content);
    if (blocks.length === 0) {
      continue;
    }

    markdownFileCount += 1;
    const docBaseName = markdownOutputName(markdownFile, options.docsDir);

    for (const block of blocks) {
      const svg = await renderMermaid(block.diagram, {
        ...theme,
        font: options.font ?? "Inter"
      });
      const png = new Resvg(svg, {
        fitTo: { mode: "width", value: options.pngWidth ?? 1600 }
      })
        .render()
        .asPng();
      const outputPath = path.join(options.outputDir, `${docBaseName}-${block.index + 1}.png`);

      await fs.writeFile(outputPath, png);
      diagramCount += 1;
      options.onWrite?.(outputPath);
    }
  }

  return {
    markdownFileCount,
    diagramCount
  };
}

async function markdownFilesList(directory: string): Promise<string[]> {
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const files: string[] = [];

  for (const entry of entries) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await markdownFilesList(entryPath)));
      continue;
    }
    if (entry.isFile() && entry.name.endsWith(".md")) {
      files.push(entryPath);
    }
  }

  return files.sort();
}

function markdownOutputName(markdownFile: string, docsDir: string): string {
  return path
    .relative(docsDir, markdownFile)
    .replace(/\.md$/i, "")
    .replace(/[\\/]/g, "-")
    .replace(/[^a-zA-Z0-9._-]/g, "-");
}
