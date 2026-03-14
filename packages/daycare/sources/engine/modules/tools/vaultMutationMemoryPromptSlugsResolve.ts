import type { ToolExecutionContext } from "@/types";

const MEMORY_COMPACTOR_PROMPT_SLUGS = new Set(["agent", "compactor"]);

/**
 * Resolves which system memory prompt documents the current memory agent may mutate.
 * Expects: toolContext.agent is available and belongs to the current user scope.
 */
export function vaultMutationMemoryPromptSlugsResolve(toolContext: ToolExecutionContext): ReadonlySet<string> {
    if (toolContext.agent.config.kind === "compactor") {
        return MEMORY_COMPACTOR_PROMPT_SLUGS;
    }
    return new Set<string>();
}
