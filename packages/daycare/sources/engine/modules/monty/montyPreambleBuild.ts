import type { Tool } from "@mariozechner/pi-ai";
import type { TSchema } from "@sinclair/typebox";

import { RLM_TOOL_NAME } from "../rlm/rlmConstants.js";
import { rlmRuntimeTools } from "../rlm/rlmRuntimeTools.js";
import { rlmSkipTool } from "../rlm/rlmSkipTool.js";
import { montyPythonDocstringEscape } from "./montyPythonDocstringEscape.js";
import { montyPythonIdentifierIs } from "./montyPythonIdentifierIs.js";
import { montyPythonSignatureBuild } from "./montyPythonSignatureBuild.js";
import { MONTY_RESPONSE_SCHEMA_KEY } from "./montyResponseSchemaKey.js";
import { montyResponseTypedDictLinesBuild } from "./montyResponseTypedDictLinesBuild.js";
import { montyResponseTypeNameFromFunction } from "./montyResponseTypeNameFromFunction.js";

/**
 * Builds a Python preamble containing synchronous tool stubs for the current tool surface.
 * Expects: tool names are unique and come from ToolResolver.listTools().
 */
export function montyPreambleBuild(tools: Tool[]): string {
    const runtimeTools = [rlmSkipTool(), ...rlmRuntimeTools()];
    const toolsWithRuntime = [...tools];
    for (const runtimeTool of runtimeTools) {
        if (toolsWithRuntime.some((tool) => tool.name === runtimeTool.name)) {
            continue;
        }
        toolsWithRuntime.push(runtimeTool);
    }

    const callableTools = toolsWithRuntime.filter(
        (tool) => tool.name !== RLM_TOOL_NAME && montyPythonIdentifierIs(tool.name)
    );
    const responseTypeNameByTool = responseTypeNameByToolBuild(callableTools);

    const lines: string[] = [
        "# You have the following tools available as Python functions.",
        "# Call tool functions directly (no await).",
        "# Tool failures raise ToolError (alias of RuntimeError).",
        "# Use print() for debug logs; the last expression is returned.",
        "",
        "from typing import Any, TypedDict",
        "",
        "ToolError = RuntimeError",
        "",
        "# Typed tool stubs for code assistance only."
    ];

    for (const tool of callableTools) {
        const responseTypeName = responseTypeNameByTool.get(tool.name);
        if (!responseTypeName) {
            continue;
        }
        const responseSchema = responseSchemaResolve(tool);
        const typedDictLines = montyResponseTypedDictLinesBuild(responseTypeName, responseSchema);
        for (const typedDictLine of typedDictLines) {
            lines.push(typedDictLine);
        }
        lines.push("");
    }

    for (const tool of callableTools) {
        const responseTypeName = responseTypeNameByTool.get(tool.name);
        if (!responseTypeName) {
            continue;
        }
        const signature = montyPythonSignatureBuild(tool);
        const description = montyPythonDocstringEscape(tool.description?.trim() || "No description.");

        lines.push(`def ${tool.name}(${signature}) -> ${responseTypeName}:`);
        lines.push(`    """${description}"""`);
        lines.push(`    raise NotImplementedError("${tool.name} is provided by runtime.")`);
        lines.push("");
    }

    return lines.join("\n").trimEnd();
}

function responseTypeNameByToolBuild(tools: Tool[]): Map<string, string> {
    const usedNames = new Set<string>();
    const map = new Map<string, string>();

    for (const tool of tools) {
        const baseName = montyResponseTypeNameFromFunction(tool.name);
        let candidate = baseName;
        let index = 2;
        while (usedNames.has(candidate)) {
            candidate = `${baseName}${index}`;
            index += 1;
        }
        usedNames.add(candidate);
        map.set(tool.name, candidate);
    }

    return map;
}

function responseSchemaResolve(tool: Tool): TSchema | undefined {
    const metadata = tool as Tool & { [MONTY_RESPONSE_SCHEMA_KEY]?: unknown };
    const schema = metadata[MONTY_RESPONSE_SCHEMA_KEY];
    if (!schemaObjectIs(schema)) {
        return undefined;
    }
    return schema as TSchema;
}

function schemaObjectIs(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
