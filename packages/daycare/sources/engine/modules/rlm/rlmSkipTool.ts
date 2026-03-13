import { Type } from "@sinclair/typebox";
import type { ResolvedTool } from "@/types";

import { SKIP_TOOL_NAME } from "./rlmConstants.js";

const noReturnSchema = Type.Object({}, { additionalProperties: false });

/**
 * Returns the synthetic inline-RLM skip tool metadata.
 * Expects: callers treat this as a control primitive and never route it to ToolResolver.execute.
 */
export function rlmSkipTool(): ResolvedTool {
    return {
        tool: {
            name: SKIP_TOOL_NAME,
            description:
                "Skip this turn — no LLM inference will run. All print() output is discarded. Call only when the task is fully mechanical or there is nothing to do.",
            parameters: Type.Object({}, { additionalProperties: false })
        },
        returns: {
            schema: noReturnSchema,
            toLLMText: () => ""
        }
    };
}
