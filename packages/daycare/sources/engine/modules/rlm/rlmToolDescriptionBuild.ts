import type { Tool } from "@mariozechner/pi-ai";
import type { AgentSkill } from "@/types";

import { rlmPreambleBuild } from "./rlmPreambleBuild.js";

/**
 * Builds the run_python tool description with the generated Python tool preamble.
 * Expects: tools contains the full current tool list from ToolResolver.
 */
export function rlmToolDescriptionBuild(tools: Tool[], skills: AgentSkill[] = []): string {
  const preamble = rlmPreambleBuild(tools);
  const skillsSection = rlmSkillsSectionBuild(skills);
  return [
    "Execute Python code to complete the task.",
    "",
    "The following functions are available:",
    "```python",
    preamble,
    "```",
    "",
    "Call tool functions directly (no `await`).",
    "Use `try/except ToolError` for tool failures.",
    ...skillsSection,
    "Use `print()` for debug output.",
    "The value of the final expression is returned."
  ].join("\n");
}

function rlmSkillsSectionBuild(skills: AgentSkill[]): string[] {
  if (skills.length === 0) {
    return [];
  }

  const lines = [
    "",
    "Available skills (use the `skill(...)` function stub to load/run them):"
  ];
  for (const skill of skills) {
    const description = skill.description ?? "";
    const sandbox = skill.sandbox ? " sandbox=true" : "";
    lines.push(`- ${skill.name}${sandbox}${description ? ` - ${description}` : ""}`);
  }
  return lines;
}
