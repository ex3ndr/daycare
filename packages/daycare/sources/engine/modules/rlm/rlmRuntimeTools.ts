import type { ResolvedTool } from "@/types";

import { rlmContextCompactTool } from "./rlmContextCompactTool.js";
import { rlmContextResetTool } from "./rlmContextResetTool.js";
import { rlmJsonParseTool } from "./rlmJsonParseTool.js";
import { rlmJsonStringifyTool } from "./rlmJsonStringifyTool.js";
import { rlmStepTool } from "./rlmStepTool.js";

/**
 * Returns synthetic inline-RLM runtime-only helper tools.
 * Expects: returned tool names remain stable because prompts and dispatch rely on them.
 */
export function rlmRuntimeTools(): ResolvedTool[] {
    return [rlmStepTool(), rlmContextResetTool(), rlmContextCompactTool(), rlmJsonParseTool(), rlmJsonStringifyTool()];
}
