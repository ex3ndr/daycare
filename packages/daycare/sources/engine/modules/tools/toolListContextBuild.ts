import type { Tool } from "@mariozechner/pi-ai";

/**
 * Builds the model-visible tool list for an agent context.
 * Execution is inline-RLM only, so no classical tools are exposed to inference.
 */
export function toolListContextBuild(): Tool[] {
    return [];
}
