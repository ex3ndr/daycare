import type { Tool } from "@mariozechner/pi-ai";
import { Type } from "@sinclair/typebox";

import { STEP_TOOL_NAME } from "./rlmConstants.js";

/**
 * Returns the synthetic inline-RLM task step runtime tool metadata.
 * Expects: runtime enforces that this is callable only during task execution.
 */
export function rlmStepTool(): Tool {
    return {
        name: STEP_TOOL_NAME,
        description: "Send prompt text to the target agent and wait for it to finish. Only available in tasks.",
        parameters: Type.Object(
            {
                prompt: Type.String({ minLength: 1 })
            },
            { additionalProperties: false }
        )
    };
}
