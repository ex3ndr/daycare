import type { Tool } from "@mariozechner/pi-ai";

import { RLM_PRINT_FUNCTION_NAME, RLM_TOOL_NAME } from "../rlm/rlmConstants.js";
import { montyPythonIdentifierIs } from "./montyPythonIdentifierIs.js";
import { montyPythonSignatureBuild } from "./montyPythonSignatureBuild.js";

/**
 * Builds the Python preamble used at Monty execution time.
 * Expects: runtime preamble stays compact and omits prompt guidance text.
 */
export function montyRuntimePreambleBuild(tools: Tool[]): string {
    const callableTools = tools.filter((tool) => tool.name !== RLM_TOOL_NAME && montyPythonIdentifierIs(tool.name));
    const lines: string[] = [
        "from typing import Any, TYPE_CHECKING",
        "",
        "ToolError = RuntimeError",
        "",
        "if TYPE_CHECKING:",
        `    def ${RLM_PRINT_FUNCTION_NAME}(*values: Any) -> None:`,
        `        raise NotImplementedError("${RLM_PRINT_FUNCTION_NAME} is provided by runtime.")`,
        ""
    ];

    for (const tool of callableTools) {
        const signature = montyPythonSignatureBuild(tool);
        lines.push(`    def ${tool.name}(${signature}) -> Any:`);
        lines.push(`        raise NotImplementedError("${tool.name} is provided by runtime.")`);
        lines.push("");
    }

    return lines.join("\n").trimEnd();
}
