import type { Tool } from "@mariozechner/pi-ai";
import { Type } from "@sinclair/typebox";

import { SKIP_TOOL_NAME } from "./rlmConstants.js";

/**
 * Returns the synthetic inline-RLM skip tool metadata.
 * Expects: callers treat this as a control primitive and never route it to ToolResolver.execute.
 */
export function rlmSkipTool(): Tool {
    return {
        name: SKIP_TOOL_NAME,
        description: "Skip this turn. Call when you have nothing useful to do right now.",
        parameters: Type.Object({}, { additionalProperties: false })
    };
}
