import type { Tool } from "@mariozechner/pi-ai";
import { Type } from "@sinclair/typebox";

import { CONTEXT_RESET_TOOL_NAME } from "./rlmConstants.js";

/**
 * Returns the synthetic inline-RLM task context reset runtime tool metadata.
 * Expects: runtime enforces that this is callable only during task execution.
 */
export function rlmContextResetTool(): Tool {
    return {
        name: CONTEXT_RESET_TOOL_NAME,
        description:
            "Reset the current agent session. Optional `message` seeds the new context. Only available in tasks.",
        parameters: Type.Object(
            {
                message: Type.Optional(Type.String({ minLength: 1 }))
            },
            { additionalProperties: false }
        )
    };
}
