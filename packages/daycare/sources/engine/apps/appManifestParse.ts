import matter from "gray-matter";

import type { AppManifest } from "./appTypes.js";

type AppFrontmatter = {
  name?: unknown;
  title?: unknown;
  description?: unknown;
  model?: unknown;
};

/**
 * Parses APP.md content into an AppManifest shape.
 * Expects: content contains YAML frontmatter with name/title/description and body system prompt.
 */
export function appManifestParse(content: string): AppManifest {
  let parsed: ReturnType<typeof matter>;
  try {
    parsed = matter(content);
  } catch {
    throw new Error("Invalid APP.md frontmatter.");
  }

  const frontmatter = parsed.data as AppFrontmatter;
  const name = toOptionalString(frontmatter.name);
  const title = toOptionalString(frontmatter.title);
  const description = toOptionalString(frontmatter.description);
  if (!name || !title || !description) {
    throw new Error("APP.md frontmatter must include name, title, and description.");
  }

  const model = toOptionalString(frontmatter.model);
  const systemPrompt = markdownSectionRead(parsed.content, "System Prompt", 2);
  if (!systemPrompt) {
    throw new Error("APP.md must include a non-empty `## System Prompt` section.");
  }

  return {
    name,
    title,
    description,
    ...(model ? { model } : {}),
    systemPrompt
  };
}

function toOptionalString(value: unknown): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function markdownSectionRead(
  markdown: string,
  heading: string,
  level: 2 | 3
): string {
  const lines = markdown.split("\n");
  const escapedHeading = heading.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const headingPattern = new RegExp(`^${"#".repeat(level)}\\s+${escapedHeading}\\s*$`, "i");
  const stopPattern =
    level === 2
      ? /^##\s+/
      : /^##\s+|^###\s+/;
  let collecting = false;
  const sectionLines: string[] = [];
  for (const line of lines) {
    if (!collecting) {
      if (headingPattern.test(line.trim())) {
        collecting = true;
      }
      continue;
    }
    if (stopPattern.test(line.trim())) {
      break;
    }
    sectionLines.push(line);
  }
  return sectionLines.join("\n").trim();
}
