import type { Tool } from "@mariozechner/pi-ai";
import type { AgentSkill } from "@/types";

import { rlmPreambleBuild } from "./rlmPreambleBuild.js";

/**
 * Builds no-tools RLM instructions for the system prompt using <run_python> tags.
 * Expects: tools contains the full runtime tool list used for Monty dispatch.
 */
export function rlmNoToolsPromptBuild(tools: Tool[], skills: AgentSkill[] = []): string {
  const preamble = rlmPreambleBuild(tools);
  const skillsSection = rlmNoToolsSkillsSectionBuild(skills);
  return [
    "## Python Execution",
    "",
    "This mode exposes zero tools to the model.",
    "To execute Python, write code inside `<run_python>...</run_python>` tags.",
    "Emit at most one Python block per assistant response.",
    "The system executes everything between the first `<run_python>` and last `</run_python>`.",
    "If you include `<say>` in the same response, all `<say>` blocks must come before `<run_python>`.",
    "Do not place `<say>` blocks after `<run_python>` in the same response.",
    "No escaping is needed.",
    "",
    "Available functions:",
    "```python",
    preamble,
    "```",
    "",
    "Call functions directly (no `await`).",
    "Use `try/except ToolError` for tool failures.",
    ...skillsSection,
    "Use `print()` for debug output.",
    "The value of the final expression is returned.",
    "Put the value you want to return as the final expression line; do not use `print()` for the final return value.",
    "Execution results are sent back as user messages wrapped in `<python_result>...</python_result>`.",
    "After receiving `<python_result>`, you get another turn and can emit `<say>` based on those results."
  ].join("\n");
}

function rlmNoToolsSkillsSectionBuild(skills: AgentSkill[]): string[] {
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
