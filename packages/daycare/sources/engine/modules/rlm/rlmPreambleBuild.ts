import type { Tool } from "@mariozechner/pi-ai";

import { RLM_PRINT_FUNCTION_NAME, RLM_TOOL_NAME } from "./rlmConstants.js";

/**
 * Builds a Python preamble containing synchronous tool stubs for the current tool surface.
 * Expects: tool names are unique and come from ToolResolver.listTools().
 */
export function rlmPreambleBuild(tools: Tool[]): string {
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
    if (!pythonIdentifierIs(tool.name)) {
      continue;
    }

    stubCount += 1;
    const signature = pythonSignatureBuild(tool);
    const description = pythonDocstringEscape(tool.description?.trim() || "No description.");

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

function pythonSignatureBuild(tool: Tool): string {
  const parameters = parametersSchemaResolve(tool);
  const properties = propertiesSchemaResolve(parameters.properties);
  const required = new Set(requiredListResolve(parameters.required));

  const requiredEntries: string[] = [];
  const optionalEntries: string[] = [];
  for (const [name, schema] of Object.entries(properties)) {
    if (!pythonIdentifierIs(name)) {
      continue;
    }
    const typeHint = pythonTypeFromSchema(schema);
    if (required.has(name)) {
      requiredEntries.push(`${name}: ${typeHint}`);
      continue;
    }
    optionalEntries.push(`${name}: ${typeHint} | None = None`);
  }

  const entries = [...requiredEntries, ...optionalEntries];
  return entries.join(", ");
}

function parametersSchemaResolve(tool: Tool): {
  properties?: Record<string, unknown>;
  required?: unknown;
} {
  const schema = tool.parameters as unknown;
  if (!recordIs(schema)) {
    return {};
  }

  return {
    properties: recordIs(schema.properties) ? schema.properties : undefined,
    required: schema.required
  };
}

function propertiesSchemaResolve(value: unknown): Record<string, unknown> {
  if (!recordIs(value)) {
    return {};
  }
  return value;
}

function requiredListResolve(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((entry): entry is string => typeof entry === "string");
}

function pythonTypeFromSchema(schema: unknown): string {
  if (!recordIs(schema)) {
    return "Any";
  }

  const anyOf = schema.anyOf;
  if (Array.isArray(anyOf) && anyOf.length > 0) {
    const union = anyOf
      .map((candidate) => pythonTypeFromSchema(candidate))
      .filter((candidate, index, all) => all.indexOf(candidate) === index);
    return union.length > 0 ? union.join(" | ") : "Any";
  }

  const oneOf = schema.oneOf;
  if (Array.isArray(oneOf) && oneOf.length > 0) {
    const union = oneOf
      .map((candidate) => pythonTypeFromSchema(candidate))
      .filter((candidate, index, all) => all.indexOf(candidate) === index);
    return union.length > 0 ? union.join(" | ") : "Any";
  }

  const type = schema.type;
  if (typeof type === "string") {
    if (type === "string") {
      return "str";
    }
    if (type === "integer") {
      return "int";
    }
    if (type === "number") {
      return "float";
    }
    if (type === "boolean") {
      return "bool";
    }
    if (type === "null") {
      return "None";
    }
    if (type === "array") {
      return `list[${pythonTypeFromSchema(schema.items)}]`;
    }
    if (type === "object") {
      const additional = schema.additionalProperties;
      if (additional === false) {
        return "dict[str, Any]";
      }
      return "dict[str, Any]";
    }
  }

  if (Array.isArray(type) && type.length > 0) {
    const union = type
      .filter((entry): entry is string => typeof entry === "string")
      .map((entry) => pythonTypeFromSchema({ type: entry }))
      .filter((candidate, index, all) => all.indexOf(candidate) === index);
    return union.length > 0 ? union.join(" | ") : "Any";
  }

  return "Any";
}

function pythonIdentifierIs(value: string): boolean {
  return /^[A-Za-z_][A-Za-z0-9_]*$/.test(value);
}

function pythonDocstringEscape(value: string): string {
  return value.replace(/\"\"\"/g, '\\"\\"\\"');
}

function recordIs(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
