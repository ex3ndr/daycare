import { Type } from "@sinclair/typebox";
import type { ResolvedTool } from "@/types";

import { STEP_TOOL_NAME } from "./rlmConstants.js";

const noReturnSchema = Type.Object({}, { additionalProperties: false });

/**
 * Returns the synthetic inline-RLM task step runtime tool metadata.
 * Expects: runtime enforces that this is callable only during task execution.
 */
export function rlmStepTool(): ResolvedTool {
    return {
        tool: {
            name: STEP_TOOL_NAME,
            description: "Send prompt text to the target agent and wait for it to finish. Only available in tasks.",
            parameters: Type.Object(
                {
                    prompt: Type.String({ minLength: 1 })
                },
                { additionalProperties: false }
            )
        },
        returns: {
            schema: noReturnSchema,
            toLLMText: () => ""
        }
    };
}
