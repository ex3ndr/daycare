import type { ToolExecutionContext } from "@/types";

const MEMORY_CLEANUP_PROMPT_SLUGS = new Set(["agent", "cleanup"]);

/**
 * Resolves which system memory prompt documents the current memory agent may mutate.
 * Expects: toolContext.agent is available and belongs to the current user scope.
 */
export function documentMutationMemoryPromptSlugsResolve(toolContext: ToolExecutionContext): ReadonlySet<string> {
    if (toolContext.agent.config.kind !== "memory") {
        return new Set<string>();
    }
    const path = toolContext.agent.path?.trim() ?? "";
    if (path.includes("/cron/memory-cleanup/") || toolContext.agent.config.name === "memory-cleanup-agent") {
        return MEMORY_CLEANUP_PROMPT_SLUGS;
    }
    return new Set<string>();
}
