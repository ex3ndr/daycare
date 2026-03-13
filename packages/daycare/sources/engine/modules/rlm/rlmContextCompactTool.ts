import { Type } from "@sinclair/typebox";
import type { ResolvedTool } from "@/types";

import { CONTEXT_COMPACT_TOOL_NAME } from "./rlmConstants.js";

const noReturnSchema = Type.Object({}, { additionalProperties: false });

/**
 * Returns the synthetic inline-RLM task context compact runtime tool metadata.
 * Expects: runtime enforces that this is callable only during task execution.
 */
export function rlmContextCompactTool(): ResolvedTool {
    return {
        tool: {
            name: CONTEXT_COMPACT_TOOL_NAME,
            description: "Compact the current agent session and wait for it to finish. Only available in tasks.",
            parameters: Type.Object({}, { additionalProperties: false })
        },
        returns: {
            schema: noReturnSchema,
            toLLMText: () => ""
        }
    };
}
