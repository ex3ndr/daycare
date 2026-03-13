import type { Tool } from "@mariozechner/pi-ai";
import type { ResolvedTool } from "@/types";

import {
    CONTEXT_COMPACT_TOOL_NAME,
    CONTEXT_RESET_TOOL_NAME,
    RLM_TOOL_NAME,
    STEP_TOOL_NAME
} from "../rlm/rlmConstants.js";
import { rlmRuntimeTools } from "../rlm/rlmRuntimeTools.js";
import { rlmSkipTool } from "../rlm/rlmSkipTool.js";
import { toolResolvedFromTool } from "../tools/toolResolvedFromTool.js";
import { montyPythonDocstringEscape } from "./montyPythonDocstringEscape.js";
import { montyPythonIdentifierIs } from "./montyPythonIdentifierIs.js";
import { montyPythonSignatureBuild } from "./montyPythonSignatureBuild.js";
import { montyResponseTypedDictLinesBuild } from "./montyResponseTypedDictLinesBuild.js";
import { montyResponseTypeNameFromFunction } from "./montyResponseTypeNameFromFunction.js";

/**
 * Builds a Python preamble containing synchronous tool stubs for the current tool surface.
 * Expects: tool names are unique and come from ToolResolver.listTools().
 */
export function montyPreambleBuild(tools: Array<ResolvedTool | Tool>): string {
    const runtimeTools = [rlmSkipTool(), ...rlmRuntimeTools()];
    const toolsWithRuntime = tools.map((entry) => resolvedToolNormalize(entry));
    for (const runtimeTool of runtimeTools) {
        if (toolsWithRuntime.some((entry) => entry.tool.name === runtimeTool.tool.name)) {
            continue;
        }
        toolsWithRuntime.push(runtimeTool);
    }

    const callableTools = toolsWithRuntime.filter(
        (entry) => entry.tool.name !== RLM_TOOL_NAME && montyPythonIdentifierIs(entry.tool.name)
    );
    const responseTypeNameByTool = responseTypeNameByToolBuild(callableTools);

    const lines: string[] = [
        "# You have the following tools available as Python functions.",
        "# Call tool functions directly (no await).",
        "# Tool failures raise ToolError (alias of RuntimeError).",
        "# Use print() for debug logs; the last expression is returned.",
        "",
        "from typing import Any, NotRequired, TypedDict",
        "",
        "ToolError = RuntimeError",
        "",
        "# Typed tool stubs for code assistance only."
    ];

    for (const entry of callableTools) {
        const responseTypeName = responseTypeNameByTool.get(entry.tool.name);
        if (!responseTypeName) {
            continue;
        }
        if (runtimeVoidToolIs(entry.tool.name)) {
            continue;
        }
        const typedDictLines = montyResponseTypedDictLinesBuild(responseTypeName, entry.returns.schema);
        for (const typedDictLine of typedDictLines) {
            lines.push(typedDictLine);
        }
        lines.push("");
    }

    for (const entry of callableTools) {
        const responseTypeName = responseTypeNameByTool.get(entry.tool.name);
        if (!responseTypeName) {
            continue;
        }
        const signature = montyPythonSignatureBuild(entry.tool);
        const description = montyPythonDocstringEscape(entry.tool.description?.trim() || "No description.");
        const returnType = runtimeVoidToolIs(entry.tool.name) ? "None" : responseTypeName;

        lines.push(`def ${entry.tool.name}(${signature}) -> ${returnType}:`);
        lines.push(`    """${description}"""`);
        lines.push(`    raise NotImplementedError("${entry.tool.name} is provided by runtime.")`);
        lines.push("");
    }

    return lines.join("\n").trimEnd();
}

function resolvedToolNormalize(entry: ResolvedTool | Tool): ResolvedTool {
    if ("tool" in entry && "returns" in entry) {
        return entry;
    }
    return toolResolvedFromTool(entry);
}

function runtimeVoidToolIs(name: string): boolean {
    return name === STEP_TOOL_NAME || name === CONTEXT_RESET_TOOL_NAME || name === CONTEXT_COMPACT_TOOL_NAME;
}

function responseTypeNameByToolBuild(tools: ResolvedTool[]): Map<string, string> {
    const usedNames = new Set<string>();
    const map = new Map<string, string>();

    for (const entry of tools) {
        const baseName = montyResponseTypeNameFromFunction(entry.tool.name);
        let candidate = baseName;
        let index = 2;
        while (usedNames.has(candidate)) {
            candidate = `${baseName}${index}`;
            index += 1;
        }
        usedNames.add(candidate);
        map.set(entry.tool.name, candidate);
    }

    return map;
}
