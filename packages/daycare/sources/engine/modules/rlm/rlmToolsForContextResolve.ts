import type { Tool } from "@mariozechner/pi-ai";
import type { ToolExecutionContext } from "@/types";

import type { ToolResolverApi } from "../toolResolver.js";

/**
 * Resolves tools visible for the current execution context.
 * Expects: context.ctx and context.agent are populated for path-aware filtering.
 */
export function rlmToolsForContextResolve(
    toolResolver: ToolResolverApi,
    context: Pick<ToolExecutionContext, "ctx" | "agent" | "allowedToolNames">
): Tool[] {
    const path = context.agent?.path;
    const config = context.agent?.config;
    const visibleTools =
        path && config ? toolResolver.listToolsForAgent({ ctx: context.ctx, path, config }) : toolResolver.listTools();

    const allowedToolNames = context.allowedToolNames;
    if (!allowedToolNames) {
        return visibleTools;
    }

    return visibleTools.filter((tool) => allowedToolNames.has(tool.name));
}
