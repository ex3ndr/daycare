import { GRAPH_ROOT_NODE_ID, type GraphNode, type GraphTree } from "./graphTypes.js";

const FOLDER_NODE_ID_PREFIX = "__folder__:";

/**
 * Projects graph nodes into a root + parent/children map for UI traversal.
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
                path: [],
                createdAt: 0,
                updatedAt: 0
            },
            content: "",
            refs: []
        } satisfies GraphNode);
    nodeById.set(root.id, root);

    const folderByPath = new Map<string, GraphNode>();
    const children = new Map<string, GraphNode[]>();
    const inboundCount = new Map<string, number>();
    const edges = new Set<string>();

    const ensureFolderNode = (pathSegments: string[]): GraphNode => {
        const key = pathSegments.join("/");
        const existing = folderByPath.get(key);
        if (existing) {
            return existing;
        }

        const title = pathSegments[pathSegments.length - 1] ?? "";
        const node: GraphNode = {
            id: `${FOLDER_NODE_ID_PREFIX}${key}`,
            frontmatter: {
                title,
                description: `Folder node: ${key}`,
                path: pathSegments.slice(0, -1),
                createdAt: 0,
                updatedAt: 0
            },
            content: "",
            refs: []
        };
        folderByPath.set(key, node);
        nodeById.set(node.id, node);
        return node;
    };

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

    for (const node of nodes) {
        if (node.id === root.id) {
            continue;
        }
        const pathSegments = node.frontmatter.path
            .map((segment) => segment.trim())
            .filter((segment) => segment.length > 0);

        let parentId = root.id;
        if (pathSegments.length > 0) {
            for (let index = 0; index < pathSegments.length; index += 1) {
                const partial = pathSegments.slice(0, index + 1);
                const folder = ensureFolderNode(partial);
                const folderParentId = index === 0 ? root.id : ensureFolderNode(pathSegments.slice(0, index)).id;
                link(folderParentId, folder);
            }
            parentId = ensureFolderNode(pathSegments).id;
        }

        link(parentId, node);
    }

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
