import type { Tool } from "@mariozechner/pi-ai";
import type { JsMontyObject } from "@pydantic/monty";
import { Type } from "@sinclair/typebox";

import type { ToolExecutionResult, ToolResultObject, ToolResultPrimitive, ToolResultValue } from "@/types";
import { montyParameterEntriesBuild } from "../monty/montyParameterEntriesBuild.js";
import { montyResponseSchemaResolve } from "../monty/montyResponseSchemaResolve.js";
import { montyValueToJs } from "../monty/montyValueToJs.js";
import { montyValueToPython } from "../monty/montyValueToPython.js";

const genericObjectSchema = Type.Object({}, { additionalProperties: Type.Unknown() });

/**
 * Converts Monty positional/keyword arguments into the JSON object expected by tool execution.
 * Expects: positional argument order matches generated Python stub parameter order.
 */
export function rlmArgsConvert(
    args: JsMontyObject[],
    kwargs: Record<string, JsMontyObject>,
    toolSchema: Tool
): unknown {
    const propertyNames = montyParameterEntriesBuild(toolSchema).map((entry) => entry.name);
    const rawArgs: Record<string, unknown> = {};

    for (let index = 0; index < args.length; index += 1) {
        const name = propertyNames[index];
        if (!name) {
            throw new Error(`Too many positional arguments for tool ${toolSchema.name}.`);
        }
        rawArgs[name] = args[index];
    }

    for (const [name, value] of Object.entries(kwargs)) {
        rawArgs[name] = value;
    }

    return montyValueToJs(rawArgs, toolSchema.parameters, `Tool "${toolSchema.name}" arguments`);
}

/**
 * Converts a tool execution result into a Python-friendly structured value.
 * Expects: typedResult matches the tool schema; missing response schema falls back to generic object checks.
 */
export function rlmResultConvert(toolResult: ToolExecutionResult<ToolResultObject>, tool?: Tool): JsMontyObject {
    const toolName = tool?.name ?? toolResult.toolMessage.toolName ?? "unknown";
    const schema = tool ? montyResponseSchemaResolve(tool) : null;
    const normalized =
        schema !== null
            ? montyValueToPython(toolResult.typedResult, schema, `Tool "${toolName}" response`)
            : montyValueToPython(toolResult.typedResult, genericObjectSchema, `Tool "${toolName}" response`);

    if (toolResultObjectIs(normalized)) {
        return normalized;
    }

    throw new Error(`Tool "${toolName}" returned a value that cannot be converted for Monty.`);
}

/**
 * Converts a runtime/helper return value into a Python-safe value using the tool response schema.
 * Expects: tool carries a hidden Monty response schema via ToolResolver or runtime tool construction.
 */
export function rlmRuntimeResultConvert(value: unknown, tool: Tool): JsMontyObject {
    const schema = montyResponseSchemaResolve(tool);
    if (!schema) {
        throw new Error(`Tool "${tool.name}" response schema is unavailable for Python conversion.`);
    }

    const normalized = montyValueToPython(value, schema, `Tool "${tool.name}" response`);
    if (toolResultObjectIs(normalized)) {
        return normalized;
    }

    throw new Error(`Tool "${tool.name}" returned a value that cannot be converted for Monty.`);
}

function recordIs(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toolResultObjectIs(value: unknown): value is ToolResultObject {
    if (!recordIs(value)) {
        return false;
    }
    return Object.values(value).every((entry) => toolResultValueIs(entry));
}

function toolResultValueIs(value: unknown): value is ToolResultValue {
    if (toolResultPrimitiveIs(value)) {
        return true;
    }
    if (Array.isArray(value)) {
        return value.every((entry) => toolResultValueIs(entry));
    }
    if (!recordIs(value)) {
        return false;
    }
    return Object.values(value).every((entry) => toolResultValueIs(entry));
}

function toolResultPrimitiveIs(value: unknown): value is ToolResultPrimitive {
    return value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean";
}
