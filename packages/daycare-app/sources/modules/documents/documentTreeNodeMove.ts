import type { DocumentItem } from "./documentsTypes";

/**
 * Validates whether a document can be moved to a new parent.
 * Returns true if the move is valid (no cycles, not moving to self or descendant).
 *
 * Expects: items is a flat array of all documents; sourceId and targetParentId are valid IDs.
 */
export function documentTreeNodeMoveValidate(
    items: DocumentItem[],
    sourceId: string,
    targetParentId: string | null
): boolean {
    if (targetParentId === null) {
        return true;
    }
    if (sourceId === targetParentId) {
        return false;
    }

    // Check if targetParentId is a descendant of sourceId (would create a cycle)
    const childrenMap = new Map<string, string[]>();
    for (const item of items) {
        if (item.parentId) {
            const existing = childrenMap.get(item.parentId);
            if (existing) {
                existing.push(item.id);
            } else {
                childrenMap.set(item.parentId, [item.id]);
            }
        }
    }

    const descendants = new Set<string>();
    const stack = [sourceId];
    while (stack.length > 0) {
        const current = stack.pop()!;
        const children = childrenMap.get(current) ?? [];
        for (const childId of children) {
            if (!descendants.has(childId)) {
                descendants.add(childId);
                stack.push(childId);
            }
        }
    }

    return !descendants.has(targetParentId);
}
