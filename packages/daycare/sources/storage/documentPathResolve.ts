import type { Context } from "@/types";

export type DocumentPathResolveRepo = {
    findById: (ctx: Context, id: string) => Promise<{ id: string; slug: string } | null>;
    findParentId: (ctx: Context, id: string) => Promise<string | null>;
};

/**
 * Builds a `~/a/b/c` path for a document by walking the active parent chain.
 * Expects: parent links form an acyclic chain for each active document version.
 */
export async function documentPathResolve(
    ctx: Context,
    documentId: string,
    repo: DocumentPathResolveRepo
): Promise<string | null> {
    const rootId = documentId.trim();
    if (!rootId) {
        return null;
    }

    const visited = new Set<string>();
    const segments: string[] = [];

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

        segments.unshift(current.slug);
        currentId = await repo.findParentId(ctx, current.id);
    }

    return `~/${segments.join("/")}`;
}
