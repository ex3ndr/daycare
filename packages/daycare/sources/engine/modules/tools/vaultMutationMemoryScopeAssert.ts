import type { ToolExecutionContext } from "@/types";
import { vaultChainResolve } from "../../../storage/vaultChainResolve.js";
import { vaultMutationMemoryPathAllowed } from "./vaultMutationMemoryPathAllowed.js";
import { vaultMutationMemoryPromptSlugsResolve } from "./vaultMutationMemoryPromptSlugsResolve.js";

type VaultMutationMemoryScopeRepo = {
    findById: (
        ctx: ToolExecutionContext["ctx"],
        id: string
    ) => Promise<{
        id: string;
        slug: string;
        version?: number | null;
    } | null>;
    findParentId: (ctx: ToolExecutionContext["ctx"], id: string) => Promise<string | null>;
};

/**
 * Ensures memory-agents mutate only memory vault entries or the dedicated memory policy entry.
 * Expects: callers pass an existing vault id resolved in the current user scope.
 */
export async function vaultMutationMemoryScopeAssert(
    toolContext: ToolExecutionContext,
    documents: VaultMutationMemoryScopeRepo,
    vaultId: string
): Promise<void> {
    if (toolContext.agent.config.kind !== "memory" && toolContext.agent.config.kind !== "compactor") {
        return;
    }

    const chain = await vaultChainResolve(toolContext.ctx, vaultId, documents);
    if (!chain || chain.length === 0) {
        throw new Error(`Vault entry not found: ${vaultId}`);
    }

    if (!vaultMutationMemoryPathAllowed(chain, vaultMutationMemoryPromptSlugsResolve(toolContext))) {
        throw new Error(
            "Memory agents can only write inside vault://memory. Compactor agents may also update vault://system/memory/agent and vault://system/memory/compactor."
        );
    }
}
