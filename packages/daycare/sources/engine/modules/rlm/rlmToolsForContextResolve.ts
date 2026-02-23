import type { Tool } from "@mariozechner/pi-ai";
import type { ToolExecutionContext } from "@/types";

import type { ToolResolverApi } from "../toolResolver.js";

/**
 * Resolves tools visible for the current execution context.
 * Expects: context.ctx and context.agent are populated for descriptor-aware filtering.
 */
export function rlmToolsForContextResolve(
    toolResolver: ToolResolverApi,
    context: Pick<ToolExecutionContext, "ctx" | "agent" | "allowedToolNames">
): Tool[] {
    const descriptor = context.agent?.descriptor;
    const visibleTools = descriptor
        ? toolResolver.listToolsForAgent({ ctx: context.ctx, descriptor })
        : toolResolver.listTools();

    const allowedToolNames = context.allowedToolNames;
    if (!allowedToolNames) {
        return visibleTools;
    }

    return visibleTools.filter((tool) => allowedToolNames.has(tool.name));
}
