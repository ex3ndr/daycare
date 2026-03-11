import type { Tool } from "@mariozechner/pi-ai";
import { Type } from "@sinclair/typebox";

import { CONTEXT_COMPACT_TOOL_NAME } from "./rlmConstants.js";

/**
 * Returns the synthetic inline-RLM task context compact runtime tool metadata.
 * Expects: runtime enforces that this is callable only during task execution.
 */
export function rlmContextCompactTool(): Tool {
    return {
        name: CONTEXT_COMPACT_TOOL_NAME,
        description: "Compact the current agent session and wait for it to finish. Only available in tasks.",
        parameters: Type.Object({}, { additionalProperties: false })
    };
}
