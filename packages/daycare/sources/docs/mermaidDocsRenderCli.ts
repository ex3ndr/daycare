import path from "node:path";
import { fileURLToPath } from "node:url";

import { THEMES } from "beautiful-mermaid";

import { mermaidDocsRender } from "./mermaidDocsRender.js";

const modulePath = fileURLToPath(import.meta.url);
const moduleDir = path.dirname(modulePath);
const repoRootDir = path.resolve(moduleDir, "../../../..");
const defaultDocsDir = path.join(repoRootDir, "docs");
const defaultOutputDir = path.join(defaultDocsDir, ".mermaid-png");

/**
 * Runs Mermaid markdown-to-PNG rendering with CLI options.
 * Expects: optional flags --docs, --out, --theme, --width.
 */
export async function mermaidDocsRenderCli(argv: readonly string[] = process.argv.slice(2)): Promise<void> {
  if (argv.includes("--help") || argv.includes("-h")) {
    printHelp();
    return;
  }

  const docsDir = path.resolve(readArgValue(argv, "--docs") ?? defaultDocsDir);
  const outputDir = path.resolve(readArgValue(argv, "--out") ?? defaultOutputDir);
  const themeName = (readArgValue(argv, "--theme") ?? "github-light") as keyof typeof THEMES;
  const widthArg = readArgValue(argv, "--width");
  const width = widthArg ? Number.parseInt(widthArg, 10) : 1600;

  if (!Number.isInteger(width) || width <= 0) {
    throw new Error(`--width must be a positive integer. Received: ${widthArg ?? "unknown"}`);
  }
  if (!THEMES[themeName]) {
    const availableThemes = Object.keys(THEMES).sort().join(", ");
    throw new Error(`Unknown theme "${themeName}". Available themes: ${availableThemes}`);
  }

  const result = await mermaidDocsRender({
    docsDir,
    outputDir,
    themeName,
    pngWidth: width,
    onWrite: (outputPath) => {
      console.log(`wrote ${path.relative(repoRootDir, outputPath)}`);
    }
  });

  console.log(
    `rendered ${result.diagramCount} diagram(s) from ${result.markdownFileCount} markdown file(s) into ${path.relative(
      repoRootDir,
      outputDir
    )}`
  );
}

function readArgValue(argv: readonly string[], flag: string): string | undefined {
  const index = argv.indexOf(flag);
  if (index < 0) {
    return undefined;
  }
  return argv[index + 1];
}

function printHelp(): void {
  console.log("Render Mermaid code fences in markdown docs to PNG files.");
  console.log("");
  console.log("Usage:");
  console.log("  yarn docs:mermaid [--docs <dir>] [--out <dir>] [--theme <name>] [--width <px>]");
  console.log("");
  console.log(`Defaults:`);
  console.log(`  --docs  ${defaultDocsDir}`);
  console.log(`  --out   ${defaultOutputDir}`);
  console.log("  --theme github-light");
  console.log("  --width 1600");
}

const isDirectRun = process.argv[1] !== undefined && path.resolve(process.argv[1]) === modulePath;
if (isDirectRun) {
  await mermaidDocsRenderCli();
}
