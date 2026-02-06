import { skillSort } from "./skillSort.js";
import type { AgentSkill } from "./skillTypes.js";
import { xmlEscape } from "../../util/xmlEscape.js";

/**
 * Formats available skills into an XML prompt segment for the system prompt.
 *
 * Expects: skills may include duplicates; the first entry per path is used.
 */
export function skillPromptFormat(skills: AgentSkill[]): string {
  const unique = new Map<string, AgentSkill>();
  for (const skill of skills) {
    if (!unique.has(skill.path)) {
      unique.set(skill.path, skill);
    }
  }
  const ordered = skillSort(Array.from(unique.values()));

  if (ordered.length === 0) {
    return "";
  }

  const lines = [
    "## Skills (mandatory)",
    "",
    "Before replying, scan the skill descriptions below:",
    "- If exactly one skill clearly applies: read its SKILL.md at the path shown, then follow it.",
    "- If multiple could apply: choose the most specific one, then read/follow it.",
    "- If none clearly apply: do not read any SKILL.md.",
    "",
    "Never read more than one skill up front; only read after selecting.",
    "",
    "<available_skills>"
  ];

  for (const skill of ordered) {
    const sourceLabel =
      skill.source === "plugin"
        ? `plugin:${skill.pluginId ?? "unknown"}`
        : skill.source;
    const name = xmlEscape(skill.name);
    const description = skill.description ? xmlEscape(skill.description) : "";
    lines.push("  <skill>");
    lines.push(`    <name>${name}</name>`);
    if (description.length > 0) {
      lines.push(`    <description>${description}</description>`);
    }
    lines.push(`    <source>${xmlEscape(sourceLabel)}</source>`);
    lines.push(`    <path>${xmlEscape(skill.path)}</path>`);
  lines.push("  </skill>");
  }

  lines.push("</available_skills>");

  return lines.join("\n");
}
