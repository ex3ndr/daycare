import { xmlEscape } from "../../util/xmlEscape.js";
import { skillSort } from "./skillSort.js";
import type { AgentSkill } from "./skillTypes.js";

/**
 * Formats available skills into an XML list for the skills system section.
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

    const lines = ["<available_skills>"];

    for (const skill of ordered) {
        const sourceLabel = skill.source === "plugin" ? `plugin:${skill.pluginId ?? "unknown"}` : skill.source;
        const name = xmlEscape(skill.name);
        const description = skill.description ? xmlEscape(skill.description) : "";
        lines.push("  <skill>");
        lines.push(`    <name>${name}</name>`);
        if (description.length > 0) {
            lines.push(`    <description>${description}</description>`);
        }
        lines.push(`    <source>${xmlEscape(sourceLabel)}</source>`);
        if (skill.sandbox === true) {
            lines.push("    <sandbox>true</sandbox>");
        }
        lines.push("  </skill>");
    }

    lines.push("</available_skills>");

    return lines.join("\n");
}
