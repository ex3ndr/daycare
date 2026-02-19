import type { Tool } from "@mariozechner/pi-ai";

import { RLM_PRINT_FUNCTION_NAME, RLM_TOOL_NAME } from "../rlm/rlmConstants.js";
import { montyPythonDocstringEscape } from "./montyPythonDocstringEscape.js";
import { montyPythonIdentifierIs } from "./montyPythonIdentifierIs.js";
import { montyPythonSignatureBuild } from "./montyPythonSignatureBuild.js";

/**
 * Builds a Python preamble containing synchronous tool stubs for the current tool surface.
 * Expects: tool names are unique and come from ToolResolver.listTools().
 */
export function montyPreambleBuild(tools: Tool[]): string {
  const lines: string[] = [
    "# You have the following tools available as Python functions.",
    "# Call tool functions directly (no await).",
    "# Tool failures raise ToolError (alias of RuntimeError).",
    "# Use print() for debug logs; the last expression is returned.",
    "",
    "from typing import Any",
    "",
    "ToolError = RuntimeError",
    "",
    "# Typed tool stubs for code assistance only (not executed).",
    "if False:",
    `    def ${RLM_PRINT_FUNCTION_NAME}(*values: Any) -> None:`,
    "        ...",
    ""
  ];
  let stubCount = 0;

  for (const tool of tools) {
    if (tool.name === RLM_TOOL_NAME) {
      continue;
    }
    if (!montyPythonIdentifierIs(tool.name)) {
      continue;
    }

    stubCount += 1;
    const signature = montyPythonSignatureBuild(tool);
    const description = montyPythonDocstringEscape(tool.description?.trim() || "No description.");

    lines.push(`    def ${tool.name}(${signature}) -> str:`);
    lines.push(`        \"\"\"${description}\"\"\"`);
    lines.push("        ...");
    lines.push("");
  }

  if (stubCount === 0) {
    lines.push("    pass");
  }

  return lines.join("\n").trimEnd();
}
