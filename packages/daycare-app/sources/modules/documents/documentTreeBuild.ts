import type { DocumentItem, DocumentTreeNode } from "./documentsTypes";

/**
 * Builds a nested tree from a flat array of documents with parentId references.
 * Returns root-level nodes sorted by title.
 *
 * Expects: items have consistent parentId references (parent exists in the array or is null).
 */
export function documentTreeBuild(items: DocumentItem[]): DocumentTreeNode[] {
    const childrenMap = new Map<string | null, DocumentItem[]>();

    for (const item of items) {
        const key = item.parentId;
        const existing = childrenMap.get(key);
        if (existing) {
            existing.push(item);
        } else {
            childrenMap.set(key, [item]);
        }
    }

    function buildNodes(parentId: string | null): DocumentTreeNode[] {
        const children = childrenMap.get(parentId) ?? [];
        return children
            .sort((a, b) => a.title.localeCompare(b.title))
            .map((doc) => ({
                document: doc,
                children: buildNodes(doc.id)
            }));
    }

    return buildNodes(null);
}
