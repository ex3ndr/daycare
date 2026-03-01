import type { Context } from "@/types";

export type DocumentChainEntry = {
    id: string;
    slug: string;
    version: number;
};

export type DocumentChainResolveRepo = {
    findById: (ctx: Context, id: string) => Promise<{ id: string; slug: string; version?: number | null } | null>;
    findParentId: (ctx: Context, id: string) => Promise<string | null>;
};

/**
 * Resolves a document parent chain from root to the target document.
 * Expects: repository methods are user-scoped and parent references are acyclic.
 */
export async function documentChainResolve(
    ctx: Context,
    documentId: string,
    repo: DocumentChainResolveRepo
): Promise<DocumentChainEntry[] | null> {
    const rootId = documentId.trim();
    if (!rootId) {
        return null;
    }

    const chain: DocumentChainEntry[] = [];
    const visited = new Set<string>();
    let currentId: string | null = rootId;
    while (currentId) {
        if (visited.has(currentId)) {
            throw new Error(`Document parent cycle detected for ${currentId}.`);
        }
        visited.add(currentId);

        const current = await repo.findById(ctx, currentId);
        if (!current) {
            return null;
        }
        chain.push({
            id: current.id,
            slug: current.slug,
            version: current.version ?? 1
        });
        currentId = await repo.findParentId(ctx, current.id);
    }

    chain.reverse();
    return chain;
}
