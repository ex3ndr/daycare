import type { DocumentItem } from "./documentsTypes";

/**
 * Resolves the root `~/document` id from the loaded document list.
 * Expects: items contains all documents for the current user.
 */
export function documentRootIdResolve(items: DocumentItem[]): string | null {
    const root = items.find((item) => item.slug === "document" && item.parentId === null);
    return root?.id ?? null;
}
