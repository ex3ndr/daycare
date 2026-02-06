import path from "node:path";
import { constants as fsConstants, promises as fs } from "node:fs";

import { getLogger } from "../../log.js";
import { SKILL_FILENAME } from "./skillConstants.js";
import type { AgentSkill, SkillSource } from "./skillTypes.js";

type SkillFrontmatter = {
  name?: string;
  description?: string;
};

const logger = getLogger("engine.skills");

/**
 * Loads a skill file, parses its frontmatter, and builds a normalized skill record.
 *
 * Expects: filePath points to a readable file; unreadable files return null.
 */
export async function skillResolve(
  filePath: string,
  source: SkillSource,
  root?: string
): Promise<AgentSkill | null> {
  const resolvedPath = path.resolve(filePath);
  const readable = await skillFileReadable(resolvedPath);
  if (!readable) {
    logger.warn({ path: resolvedPath }, "Skill file not readable; skipping");
    return null;
  }

  let content = "";
  try {
    content = await fs.readFile(resolvedPath, "utf8");
  } catch (error) {
    logger.warn({ path: resolvedPath, error }, "Skill file not readable; skipping");
    return null;
  }

  const metadata = skillFrontmatterParse(content);
  const name = metadata.name?.trim().length ? metadata.name.trim() : skillNameFormat(resolvedPath);
  const description = metadata.description?.trim().length ? metadata.description.trim() : null;
  const id = skillIdBuild(resolvedPath, source, root);

  return {
    id,
    name,
    description,
    path: resolvedPath,
    source: source.source,
    pluginId: source.source === "plugin" ? source.pluginId : undefined
  };
}

async function skillFileReadable(filePath: string): Promise<boolean> {
  try {
    const stats = await fs.stat(filePath);
    if (!stats.isFile()) {
      return false;
    }
    await fs.access(filePath, fsConstants.R_OK);
    return true;
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT" || code === "EACCES") {
      return false;
    }
    throw error;
  }
}

function skillFrontmatterParse(content: string): SkillFrontmatter {
  const lines = content.split(/\r?\n/);
  const firstLine = lines[0] ?? "";
  if (lines.length === 0 || firstLine.trim() !== "---") {
    return {};
  }

  const frontmatter: string[] = [];
  for (let i = 1; i < lines.length; i += 1) {
    const line = lines[i] ?? "";
    if (line.trim() === "---" || line.trim() === "...") {
      break;
    }
    frontmatter.push(line);
  }

  if (frontmatter.length === 0) {
    return {};
  }

  return skillYamlFrontmatterParse(frontmatter);
}

function skillYamlFrontmatterParse(lines: string[]): SkillFrontmatter {
  const result: SkillFrontmatter = {};

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i] ?? "";
    if (!line || line.trim().length === 0 || line.trim().startsWith("#")) {
      continue;
    }

    const match = line.match(/^([A-Za-z0-9_-]+)\s*:\s*(.*)$/);
    if (!match) {
      continue;
    }

    const key = match[1];
    let value = match[2] ?? "";

    if (value === "|" || value === ">" || value.trim().length === 0) {
      const block = skillYamlBlockCollect(lines, i + 1);
      i = block.nextIndex - 1;
      value = value === ">" ? block.value.replace(/\n/g, " ") : block.value;
    } else {
      value = value.trim();
    }

    const normalized = skillYamlValueNormalize(value);
    if (key === "name") {
      result.name = normalized;
    }
    if (key === "description") {
      result.description = normalized;
    }
  }

  return result;
}

function skillYamlBlockCollect(
  lines: string[],
  startIndex: number
): { value: string; nextIndex: number } {
  const blockLines: string[] = [];
  let minIndent: number | null = null;
  let index = startIndex;

  for (; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    if (line.trim().length === 0) {
      blockLines.push("");
      continue;
    }
    const match = line.match(/^(\s+)/);
    if (!match) {
      break;
    }
    const indentMatch = match[1];
    if (!indentMatch) {
      break;
    }
    const indent = indentMatch.length;
    if (minIndent === null || indent < minIndent) {
      minIndent = indent;
    }
    blockLines.push(line);
  }

  if (blockLines.length === 0) {
    return { value: "", nextIndex: index };
  }

  const trimmed = blockLines.map((line) => {
    if (minIndent && line.length >= minIndent) {
      return line.slice(minIndent);
    }
    return line.trim();
  });

  return { value: trimmed.join("\n").trimEnd(), nextIndex: index };
}

function skillYamlValueNormalize(value: string): string {
  if (value.length === 0) {
    return value;
  }
  if (value.startsWith('"') && value.endsWith('"')) {
    return skillYamlDoubleUnescape(value.slice(1, -1));
  }
  if (value.startsWith("'") && value.endsWith("'")) {
    return value.slice(1, -1).replace(/''/g, "'");
  }
  return value;
}

function skillYamlDoubleUnescape(value: string): string {
  return value
    .replace(/\\n/g, "\n")
    .replace(/\\t/g, "\t")
    .replace(/\\r/g, "\r")
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, "\\");
}

function skillIdBuild(filePath: string, source: SkillSource, root?: string): string {
  const fileName = path.basename(filePath).toLowerCase();
  let slug = "";

  if (fileName === SKILL_FILENAME) {
    if (root) {
      slug = path.relative(root, path.dirname(filePath));
    } else {
      slug = path.basename(path.dirname(filePath));
    }
  } else {
    slug = path.basename(filePath, path.extname(filePath));
  }

  const normalized = slug.length > 0 ? slug.split(path.sep).join("/") : "skill";
  if (source.source === "plugin") {
    return `plugin:${source.pluginId}/${normalized}`;
  }
  if (source.source === "config") {
    return `config:${normalized}`;
  }
  return `core:${normalized}`;
}

function skillNameFormat(filePath: string): string {
  const fileName = path.basename(filePath).toLowerCase();
  if (fileName === SKILL_FILENAME) {
    return skillNameNormalize(path.basename(path.dirname(filePath)));
  }
  return skillNameNormalize(path.basename(filePath, path.extname(filePath)));
}

function skillNameNormalize(value: string): string {
  return value.replace(/[-_]+/g, " ").trim();
}
