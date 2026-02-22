import { GRAPH_ROOT_NODE_ID, type GraphNode, type GraphTree } from "./graphTypes.js";

/**
 * Projects graph nodes into a root + parent/children map for UI traversal.
 * Hierarchy is determined by refs: a parent node's refs list its children.
 * Nodes not referenced by any parent are attached to root.
 * Expects: node ids are unique; root node id is `__root__` when present.
 */
export function graphTreeBuild(nodes: GraphNode[]): GraphTree {
    const nodeById = new Map<string, GraphNode>();
    for (const node of nodes) {
        nodeById.set(node.id, node);
    }

    const root =
        nodeById.get(GRAPH_ROOT_NODE_ID) ??
        ({
            id: GRAPH_ROOT_NODE_ID,
            frontmatter: {
                title: "Memory Summary",
                description: "Structured summary of all memories",
                createdAt: 0,
                updatedAt: 0
            },
            content: "",
            refs: []
        } satisfies GraphNode);
    nodeById.set(root.id, root);

    const children = new Map<string, GraphNode[]>();
    const inboundCount = new Map<string, number>();
    const edges = new Set<string>();

    const link = (parentId: string, childNode: GraphNode): void => {
        const edgeKey = `${parentId}->${childNode.id}`;
        if (edges.has(edgeKey)) {
            return;
        }
        edges.add(edgeKey);

        const siblings = children.get(parentId) ?? [];
        siblings.push(childNode);
        children.set(parentId, siblings);
        inboundCount.set(childNode.id, (inboundCount.get(childNode.id) ?? 0) + 1);
    };

    // Build hierarchy from refs: each node's refs are its children.
    for (const node of nodeById.values()) {
        for (const ref of node.refs) {
            if (ref === node.id) {
                continue;
            }
            const target = nodeById.get(ref);
            if (!target) {
                continue;
            }
            link(node.id, target);
        }
    }

    // Orphan nodes (not referenced by anyone) attach to root.
    for (const node of nodeById.values()) {
        if (node.id === root.id) {
            continue;
        }
        const inbound = inboundCount.get(node.id) ?? 0;
        if (inbound === 0) {
            link(root.id, node);
        }
    }

    const sortedChildren = new Map<string, GraphNode[]>();
    for (const [parentId, childNodes] of children.entries()) {
        const sorted = [...childNodes].sort((left, right) => {
            const leftTitle = left.frontmatter.title.toLowerCase();
            const rightTitle = right.frontmatter.title.toLowerCase();
            if (leftTitle === rightTitle) {
                return left.id.localeCompare(right.id);
            }
            return leftTitle.localeCompare(rightTitle);
        });
        sortedChildren.set(parentId, sorted);
    }

    if (!sortedChildren.has(root.id)) {
        sortedChildren.set(root.id, []);
    }

    return {
        root,
        children: sortedChildren
    };
}
