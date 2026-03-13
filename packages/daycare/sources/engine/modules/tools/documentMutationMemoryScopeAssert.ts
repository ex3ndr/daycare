import type { ToolExecutionContext } from "@/types";
import { documentChainResolve } from "../../../storage/documentChainResolve.js";
import { documentMutationMemoryPathAllowed } from "./documentMutationMemoryPathAllowed.js";

type DocumentMutationMemoryScopeRepo = {
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
 * Ensures memory-agents mutate only memory documents or the dedicated memory policy document.
 * Expects: callers pass an existing document id resolved in the current user scope.
 */
export async function documentMutationMemoryScopeAssert(
    toolContext: ToolExecutionContext,
    documents: DocumentMutationMemoryScopeRepo,
    documentId: string
): Promise<void> {
    if (toolContext.agent.config.kind !== "memory") {
        return;
    }

    const chain = await documentChainResolve(toolContext.ctx, documentId, documents);
    if (!chain || chain.length === 0) {
        throw new Error(`Document not found: ${documentId}`);
    }

    if (!documentMutationMemoryPathAllowed(chain)) {
        throw new Error("Memory agents can only write inside doc://memory or doc://system/memory.");
    }
}
