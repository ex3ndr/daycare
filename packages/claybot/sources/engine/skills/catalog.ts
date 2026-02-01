import path from "node:path";
import { constants as fsConstants, promises as fs } from "node:fs";
import { fileURLToPath } from "node:url";

import { getLogger } from "../../log.js";

export type AgentSkill = {
  id: string;
  name: string;
  description?: string | null;
  path: string;
  source: "core" | "plugin";
  pluginId?: string;
};

export type PluginSkillRegistration = {
  pluginId: string;
  path: string;
};

type SkillSource =
  | { source: "core"; root?: string }
  | { source: "plugin"; pluginId: string };

type SkillFrontmatter = {
  name?: string;
  description?: string;
};

const logger = getLogger("engine.skills");
const SKILL_FILENAME = "skill.md";
const CORE_SKILLS_ROOT = fileURLToPath(new URL("../../skills", import.meta.url));

export async function listCoreSkills(): Promise<AgentSkill[]> {
  return listSkillsFromRoot(CORE_SKILLS_ROOT, { source: "core", root: CORE_SKILLS_ROOT });
}

export async function listRegisteredSkills(
  registrations: PluginSkillRegistration[]
): Promise<AgentSkill[]> {
  const skills: AgentSkill[] = [];
  const seen = new Set<string>();

  for (const registration of registrations) {
    const resolvedPath = path.resolve(registration.path);
    const key = `${registration.pluginId}:${resolvedPath}`;
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    const skill = await resolveSkill(resolvedPath, {
      source: "plugin",
      pluginId: registration.pluginId
    });
    if (skill) {
      skills.push(skill);
    }
  }

  return sortSkills(skills);
}

export function formatSkillsPrompt(skills: AgentSkill[]): string {
  const unique = new Map<string, AgentSkill>();
  for (const skill of skills) {
    if (!unique.has(skill.path)) {
      unique.set(skill.path, skill);
    }
  }
  const ordered = sortSkills(Array.from(unique.values()));

  if (ordered.length === 0) {
    return "";
  }

  const lines = [
    "<skills>",
    "  <instructions>",
    "    <load>Read the skill file to load it.</load>",
    "    <reload>Read the skill file again to reload it.</reload>",
    "    <unload>Explicitly ignore the skill guidance to unload it.</unload>",
    "  </instructions>",
    "  <available>"
  ];

  for (const skill of ordered) {
    const sourceLabel =
      skill.source === "plugin" ? `plugin:${skill.pluginId ?? "unknown"}` : "core";
    const name = escapeXml(skill.name);
    const description = skill.description ? escapeXml(skill.description) : "";
    lines.push("    <skill>");
    lines.push(`      <name>${name}</name>`);
    if (description.length > 0) {
      lines.push(`      <description>${description}</description>`);
    }
    lines.push(`      <source>${escapeXml(sourceLabel)}</source>`);
    lines.push(`      <path>${escapeXml(skill.path)}</path>`);
    lines.push("    </skill>");
  }

  lines.push("  </available>");
  lines.push("</skills>");

  return lines.join("\n");
}

export async function listSkillsFromRoot(
  root: string,
  source: SkillSource
): Promise<AgentSkill[]> {
  const files = await collectSkillFiles(root);
  const skills: AgentSkill[] = [];
  for (const file of files) {
    const skill = await resolveSkill(file, source, root);
    if (skill) {
      skills.push(skill);
    }
  }
  return sortSkills(skills);
}

async function collectSkillFiles(root: string): Promise<string[]> {
  let entries: Array<import("node:fs").Dirent> = [];
  try {
    entries = await fs.readdir(root, { withFileTypes: true });
  } catch (error) {
    const code = (error as NodeJS.ErrnoException).code;
    if (code === "ENOENT") {
      logger.warn({ path: root }, "Skills root missing; skipping");
      return [];
    }
    if (code === "ENOTDIR") {
      logger.warn({ path: root }, "Skills root is not a directory; skipping");
      return [];
    }
    throw error;
  }

  const results: string[] = [];
  for (const entry of entries) {
    const fullPath = path.join(root, entry.name);
    if (entry.isDirectory()) {
      results.push(...(await collectSkillFiles(fullPath)));
      continue;
    }
    if (!entry.isFile()) {
      continue;
    }
    if (entry.name.toLowerCase() === SKILL_FILENAME) {
      results.push(fullPath);
    }
  }

  return results;
}

async function resolveSkill(
  filePath: string,
  source: SkillSource,
  root?: string
): Promise<AgentSkill | null> {
  const resolvedPath = path.resolve(filePath);
  const readable = await isReadableFile(resolvedPath);
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

  const metadata = parseSkillFrontmatter(content);
  const name = metadata.name?.trim().length ? metadata.name.trim() : formatSkillName(resolvedPath);
  const description = metadata.description?.trim().length ? metadata.description.trim() : null;
  const id = buildSkillId(resolvedPath, source, root);

  return {
    id,
    name,
    description,
    path: resolvedPath,
    source: source.source,
    pluginId: source.source === "plugin" ? source.pluginId : undefined
  };
}

async function isReadableFile(filePath: string): Promise<boolean> {
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

function parseSkillFrontmatter(content: string): SkillFrontmatter {
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

  return parseYamlFrontmatter(frontmatter);
}

function parseYamlFrontmatter(lines: string[]): SkillFrontmatter {
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
      const block = collectBlockScalar(lines, i + 1);
      i = block.nextIndex - 1;
      value = value === ">" ? block.value.replace(/\n/g, " ") : block.value;
    } else {
      value = value.trim();
    }

    const normalized = normalizeYamlValue(value);
    if (key === "name") {
      result.name = normalized;
    }
    if (key === "description") {
      result.description = normalized;
    }
  }

  return result;
}

function collectBlockScalar(lines: string[], startIndex: number): { value: string; nextIndex: number } {
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

function normalizeYamlValue(value: string): string {
  if (value.length === 0) {
    return value;
  }
  if (value.startsWith("\"") && value.endsWith("\"")) {
    return unescapeYamlDouble(value.slice(1, -1));
  }
  if (value.startsWith("'") && value.endsWith("'")) {
    return value.slice(1, -1).replace(/''/g, "'");
  }
  return value;
}

function unescapeYamlDouble(value: string): string {
  return value
    .replace(/\\n/g, "\n")
    .replace(/\\t/g, "\t")
    .replace(/\\r/g, "\r")
    .replace(/\\"/g, "\"")
    .replace(/\\\\/g, "\\");
}

function buildSkillId(filePath: string, source: SkillSource, root?: string): string {
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
  return `core:${normalized}`;
}

function formatSkillName(filePath: string): string {
  const fileName = path.basename(filePath).toLowerCase();
  if (fileName === SKILL_FILENAME) {
    return normalizeName(path.basename(path.dirname(filePath)));
  }
  return normalizeName(path.basename(filePath, path.extname(filePath)));
}

function normalizeName(value: string): string {
  return value.replace(/[-_]+/g, " ").trim();
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function sortSkills(skills: AgentSkill[]): AgentSkill[] {
  return skills.sort((a, b) => {
    const nameSort = a.name.localeCompare(b.name);
    if (nameSort !== 0) {
      return nameSort;
    }
    return a.path.localeCompare(b.path);
  });
}
