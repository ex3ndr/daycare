import type { Tool } from "@mariozechner/pi-ai";
import { Type } from "@sinclair/typebox";

import { MONTY_RESPONSE_SCHEMA_KEY } from "../monty/montyResponseSchemaKey.js";
import { JSON_PARSE_TOOL_NAME } from "./rlmConstants.js";

const jsonParseParameters = Type.Object(
    {
        text: Type.String()
    },
    { additionalProperties: false }
);

const jsonParseResponse = Type.Object(
    {
        value: Type.Any()
    },
    { additionalProperties: false }
);

/**
 * Returns the synthetic inline-RLM JSON parse runtime tool metadata.
 * Expects: callers execute this inside RLM runtime and never route to ToolResolver.execute.
 */
export function rlmJsonParseTool(): Tool {
    const tool: Tool = {
        name: JSON_PARSE_TOOL_NAME,
        description: "Parse JSON string text and return the parsed value in `value`.",
        parameters: jsonParseParameters
    };
    Object.defineProperty(tool, MONTY_RESPONSE_SCHEMA_KEY, {
        value: jsonParseResponse,
        enumerable: false,
        configurable: false
    });
    return tool;
}
