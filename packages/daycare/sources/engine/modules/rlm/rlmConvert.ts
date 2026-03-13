import type { Tool } from "@mariozechner/pi-ai";
import type { JsMontyObject } from "@pydantic/monty";
import { Type } from "@sinclair/typebox";
import type {
    ResolvedTool,
    ToolExecutionResult,
    ToolResultObject,
    ToolResultPrimitive,
    ToolResultValue
} from "@/types";
import { montyParameterEntriesBuild } from "../monty/montyParameterEntriesBuild.js";
import { montyValueToJs } from "../monty/montyValueToJs.js";
import { montyValueToPython } from "../monty/montyValueToPython.js";
import { toolResolvedFromTool } from "../tools/toolResolvedFromTool.js";

const genericObjectSchema = Type.Object({}, { additionalProperties: Type.Unknown() });

/**
 * Converts Monty positional/keyword arguments into the JSON object expected by tool execution.
 * Expects: positional argument order matches generated Python stub parameter order.
 */
export function rlmArgsConvert(
    args: JsMontyObject[],
    kwargs: Record<string, JsMontyObject>,
    toolSchema: ResolvedTool | Tool
): unknown {
    const resolvedTool = resolvedToolNormalize(toolSchema);
    const propertyNames = montyParameterEntriesBuild(resolvedTool.tool).map((entry) => entry.name);
    const rawArgs: Record<string, unknown> = {};

    for (let index = 0; index < args.length; index += 1) {
        const name = propertyNames[index];
        if (!name) {
            throw new Error(`Too many positional arguments for tool ${resolvedTool.tool.name}.`);
        }
        rawArgs[name] = args[index];
    }

    for (const [name, value] of Object.entries(kwargs)) {
        rawArgs[name] = value;
    }

    return montyValueToJs(rawArgs, resolvedTool.tool.parameters, `Tool "${resolvedTool.tool.name}" arguments`);
}

/**
 * Converts a tool execution result into a Python-friendly structured value.
 * Expects: typedResult matches the tool schema; missing response schema falls back to generic object checks.
 */
export function rlmResultConvert(
    toolResult: ToolExecutionResult<ToolResultObject>,
    tool?: ResolvedTool | Tool
): JsMontyObject {
    const resolvedTool = tool ? resolvedToolNormalize(tool) : null;
    const toolName = resolvedTool?.tool.name ?? toolResult.toolMessage.toolName ?? "unknown";
    const schema = resolvedTool?.returns.schema ?? null;
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
export function rlmRuntimeResultConvert(value: unknown, tool: ResolvedTool | Tool): JsMontyObject {
    const resolvedTool = resolvedToolNormalize(tool);
    const normalized = montyValueToPython(
        value,
        resolvedTool.returns.schema,
        `Tool "${resolvedTool.tool.name}" response`
    );
    if (toolResultObjectIs(normalized)) {
        return normalized;
    }

    throw new Error(`Tool "${resolvedTool.tool.name}" returned a value that cannot be converted for Monty.`);
}

function resolvedToolNormalize(tool: ResolvedTool | Tool): ResolvedTool {
    if ("tool" in tool && "returns" in tool) {
        return tool;
    }
    return toolResolvedFromTool(tool);
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
