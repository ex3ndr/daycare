import type { Tool } from "@mariozechner/pi-ai";
import { Type } from "@sinclair/typebox";

import type { ResolvedTool } from "@/types";

const fallbackReturnSchema = Type.Object({}, { additionalProperties: Type.Unknown() });

/**
 * Wraps a plain pi-ai Tool in a loose ResolvedTool for compatibility with older mocks/callers.
 * Expects: production callers should prefer explicit ResolvedTool values with a real return schema.
 */
export function toolResolvedFromTool(tool: Tool): ResolvedTool {
    return {
        tool,
        returns: {
            schema: fallbackReturnSchema,
            toLLMText: () => ""
        }
    };
}
