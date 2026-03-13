import type { ResolvedTool, ToolExecutionContext } from "@/types";

import type { ToolResolverApi } from "../toolResolver.js";
import { toolResolvedFromTool } from "../tools/toolResolvedFromTool.js";

/**
 * Resolves tools visible for the current execution context.
 * Expects: context.ctx and context.agent are populated for path-aware filtering.
 */
export function rlmToolsForContextResolve(
    toolResolver: ToolResolverApi,
    context: Pick<ToolExecutionContext, "ctx" | "agent" | "allowedToolNames">
): ResolvedTool[] {
    const path = context.agent?.path;
    const config = context.agent?.config;
    const visibleTools =
        path && config
            ? (toolResolver.listResolvedExecutableToolsForAgent?.({ ctx: context.ctx, path, config }) ??
              toolResolver
                  .listExecutableToolsForAgent?.({ ctx: context.ctx, path, config })
                  ?.map(toolResolvedFromTool) ??
              toolResolver.listResolvedToolsForAgent?.({ ctx: context.ctx, path, config }) ??
              toolResolver.listToolsForAgent({ ctx: context.ctx, path, config }).map(toolResolvedFromTool))
            : (toolResolver.listResolvedTools?.() ?? toolResolver.listTools().map(toolResolvedFromTool));

    const allowedToolNames = context.allowedToolNames;
    if (!allowedToolNames) {
        return visibleTools;
    }

    return visibleTools.filter((entry) => allowedToolNames.has(entry.tool.name));
}
