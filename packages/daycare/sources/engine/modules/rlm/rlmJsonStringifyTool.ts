import { Type } from "@sinclair/typebox";
import type { ResolvedTool } from "@/types";

import { JSON_STRINGIFY_TOOL_NAME } from "./rlmConstants.js";

const jsonStringifyParameters = Type.Object(
    {
        value: Type.Any(),
        pretty: Type.Optional(Type.Boolean())
    },
    { additionalProperties: false }
);

const jsonStringifyResponse = Type.Object(
    {
        value: Type.String()
    },
    { additionalProperties: false }
);

/**
 * Returns the synthetic inline-RLM JSON stringify runtime tool metadata.
 * Expects: callers execute this inside RLM runtime and never route to ToolResolver.execute.
 */
export function rlmJsonStringifyTool(): ResolvedTool {
    return {
        tool: {
            name: JSON_STRINGIFY_TOOL_NAME,
            description: "Serialize a value into a JSON string in `value`. Set pretty=True for indentation.",
            parameters: jsonStringifyParameters
        },
        returns: {
            schema: jsonStringifyResponse,
            toLLMText: () => ""
        }
    };
}
