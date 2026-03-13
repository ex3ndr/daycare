import type { Context } from "@/types";

export type DocumentPathFindRepo = {
    findBySlugAndParent: (ctx: Context, slug: string, parentId: string | null) => Promise<{ id: string } | null>;
};

const VAULT_PATH_PREFIX = "vault://";
const LEGACY_DOCUMENT_PATH_PREFIX = "doc://";
const VAULT_ROOT_SEGMENT = "vault";
const DOCUMENT_ROOT_STORAGE_SLUG = "document";

/**
 * Resolves a public `vault://a/b/c` path to a document id.
 * Also accepts legacy `doc://...` paths so existing stored links keep resolving.
 *
 * Expects: `repo.findBySlugAndParent` only returns active documents for `ctx.userId`.
 */
export async function documentPathFind(ctx: Context, path: string, repo: DocumentPathFindRepo): Promise<string | null> {
    const normalized = path.trim();
    const remainder = documentPathRemainderExtract(normalized);
    if (remainder === null) {
        return null;
    }
    if (!remainder || remainder.startsWith("/")) {
        return null;
    }

    const rawSegments = remainder.split("/");
    const segments = rawSegments.map((segment) => segment.trim());
    if (segments.some((segment) => segment.length === 0)) {
        return null;
    }
    if (segments.length === 0) {
        return null;
    }

    let parentId: string | null = null;
    for (const [index, segment] of segments.entries()) {
        const storageSegment =
            index === 0 && (segment === VAULT_ROOT_SEGMENT || segment === DOCUMENT_ROOT_STORAGE_SLUG)
                ? DOCUMENT_ROOT_STORAGE_SLUG
                : segment;
        const match = await repo.findBySlugAndParent(ctx, storageSegment, parentId);
        if (!match) {
            return null;
        }
        parentId = match.id;
    }

    return parentId;
}

function documentPathRemainderExtract(path: string): string | null {
    if (path.startsWith(VAULT_PATH_PREFIX)) {
        return path.slice(VAULT_PATH_PREFIX.length);
    }
    if (path.startsWith(LEGACY_DOCUMENT_PATH_PREFIX)) {
        return path.slice(LEGACY_DOCUMENT_PATH_PREFIX.length);
    }
    return null;
}
