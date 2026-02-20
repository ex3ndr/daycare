import type { Tool } from "@mariozechner/pi-ai";
import type { JsMontyObject } from "@pydantic/monty";

import type { ToolExecutionResult, ToolResultPrimitive, ToolResultRow, ToolResultShallowObject } from "@/types";
import { montyParameterEntriesBuild } from "../monty/montyParameterEntriesBuild.js";

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
    const output: Record<string, unknown> = {};

    for (let index = 0; index < args.length; index += 1) {
        const name = propertyNames[index];
        if (!name) {
            throw new Error(`Too many positional arguments for tool ${toolSchema.name}.`);
        }
        output[name] = montyValueConvert(args[index]);
    }

    const convertedKwargs = montyValueConvert(kwargs);
    if (!recordIs(convertedKwargs)) {
        throw new Error("Tool kwargs must convert to an object.");
    }
    for (const [name, value] of Object.entries(convertedKwargs)) {
        output[name] = value;
    }

    return output;
}

/**
 * Converts a tool execution result into a Python-friendly string value.
 * Expects: tool result content follows the ToolResultMessage text block convention.
 */
export function rlmResultConvert(toolResult: ToolExecutionResult<ToolResultShallowObject>): JsMontyObject {
    if (toolResultShallowObjectIs(toolResult.typedResult)) {
        return toolResult.typedResult;
    }
    if (toolResultShallowObjectIs(toolResult.toolMessage.details)) {
        return toolResult.toolMessage.details;
    }
    const text = toolResult.toolMessage.content
        .filter((part) => part.type === "text")
        .map((part) => ("text" in part && typeof part.text === "string" ? part.text : ""))
        .join("\n")
        .trim();

    if (text.length > 0) {
        return text;
    }

    if (toolResult.toolMessage.isError) {
        return "Tool execution failed.";
    }

    return "";
}

function montyValueConvert(value: unknown): unknown {
    if (typeof value === "bigint") {
        if (value <= BigInt(Number.MAX_SAFE_INTEGER) && value >= BigInt(Number.MIN_SAFE_INTEGER)) {
            return Number(value);
        }
        return value.toString();
    }

    if (value instanceof Map) {
        const result: Record<string, unknown> = {};
        for (const [key, item] of value.entries()) {
            result[String(key)] = montyValueConvert(item);
        }
        return result;
    }

    if (Array.isArray(value)) {
        return value.map((entry) => montyValueConvert(entry));
    }

    if (!recordIs(value)) {
        return value;
    }

    const result: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(value)) {
        result[key] = montyValueConvert(entry);
    }
    return result;
}

function recordIs(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toolResultShallowObjectIs(value: unknown): value is ToolResultShallowObject {
    if (!recordIs(value)) {
        return false;
    }
    return Object.values(value).every((entry) => toolResultValueIs(entry));
}

function toolResultValueIs(value: unknown): value is ToolResultPrimitive | ToolResultRow[] {
    if (toolResultPrimitiveIs(value)) {
        return true;
    }
    if (!Array.isArray(value)) {
        return false;
    }
    return value.every((row) => toolResultRowIs(row));
}

function toolResultRowIs(value: unknown): value is ToolResultRow {
    if (!recordIs(value)) {
        return false;
    }
    return Object.values(value).every((entry) => toolResultPrimitiveIs(entry));
}

function toolResultPrimitiveIs(value: unknown): value is ToolResultPrimitive {
    return value === null || typeof value === "string" || typeof value === "number" || typeof value === "boolean";
}
