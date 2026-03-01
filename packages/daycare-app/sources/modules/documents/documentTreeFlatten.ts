import type { DocumentTreeNode, FlatTreeEntry } from "./documentsTypes";

/**
 * Flattens a nested document tree into a visible list respecting expanded state.
 * Only children of expanded nodes are included in the output.
 *
 * Expects: tree is a valid DocumentTreeNode array; expandedIds contains IDs of expanded nodes.
 */
export function documentTreeFlatten(tree: DocumentTreeNode[], expandedIds: Set<string>): FlatTreeEntry[] {
    const result: FlatTreeEntry[] = [];

    function walk(nodes: DocumentTreeNode[], depth: number): void {
        for (const node of nodes) {
            const expanded = expandedIds.has(node.document.id);
            const hasChildren = node.children.length > 0;
            result.push({ document: node.document, depth, hasChildren, expanded });
            if (expanded && hasChildren) {
                walk(node.children, depth + 1);
            }
        }
    }

    walk(tree, 0);
    return result;
}
