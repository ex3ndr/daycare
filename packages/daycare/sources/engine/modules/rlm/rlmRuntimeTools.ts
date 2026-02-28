import type { Tool } from "@mariozechner/pi-ai";

import { rlmJsonParseTool } from "./rlmJsonParseTool.js";
import { rlmJsonStringifyTool } from "./rlmJsonStringifyTool.js";

/**
 * Returns synthetic inline-RLM runtime-only helper tools.
 * Expects: returned tool names remain stable because prompts and dispatch rely on them.
 */
export function rlmRuntimeTools(): Tool[] {
    return [rlmJsonParseTool(), rlmJsonStringifyTool()];
}
