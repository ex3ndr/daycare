import type { Context } from "@/types";

export type DocumentPathFindRepo = {
    findBySlugAndParent: (ctx: Context, slug: string, parentId: string | null) => Promise<{ id: string } | null>;
};

/**
 * Resolves a `~/a/b/c` document path to a document id.
 * Expects: `repo.findBySlugAndParent` only returns active documents for `ctx.userId`.
 */
export async function documentPathFind(ctx: Context, path: string, repo: DocumentPathFindRepo): Promise<string | null> {
    const normalized = path.trim();
    if (!normalized.startsWith("~/")) {
        return null;
    }

    const segments = normalized
        .slice(2)
        .split("/")
        .map((segment) => segment.trim())
        .filter((segment) => segment.length > 0);
    if (segments.length === 0) {
        return null;
    }

    let parentId: string | null = null;
    for (const segment of segments) {
        const match = await repo.findBySlugAndParent(ctx, segment, parentId);
        if (!match) {
            return null;
        }
        parentId = match.id;
    }

    return parentId;
}
