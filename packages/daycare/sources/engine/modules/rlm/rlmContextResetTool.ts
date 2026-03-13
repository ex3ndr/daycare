import { Type } from "@sinclair/typebox";
import type { ResolvedTool } from "@/types";

import { CONTEXT_RESET_TOOL_NAME } from "./rlmConstants.js";

const noReturnSchema = Type.Object({}, { additionalProperties: false });

/**
 * Returns the synthetic inline-RLM task context reset runtime tool metadata.
 * Expects: runtime enforces that this is callable only during task execution.
 */
export function rlmContextResetTool(): ResolvedTool {
    return {
        tool: {
            name: CONTEXT_RESET_TOOL_NAME,
            description:
                "Reset the current agent session. Optional `message` seeds the new context. Only available in tasks.",
            parameters: Type.Object(
                {
                    message: Type.Optional(Type.String({ minLength: 1 }))
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
