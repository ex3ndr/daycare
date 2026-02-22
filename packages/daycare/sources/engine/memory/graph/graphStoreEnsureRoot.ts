import { promises as fs } from "node:fs";
import path from "node:path";

import { graphNodeParse } from "./graphNodeParse.js";
import { graphStoreWrite } from "./graphStoreWrite.js";
import { GRAPH_ROOT_FILENAME, GRAPH_ROOT_NODE_ID, type GraphNode } from "./graphTypes.js";

/**
 * Ensures the root node file exists in memory storage.
 * Expects: caller provides the user-scoped `memory/` directory.
 */
export async function graphStoreEnsureRoot(memoryDir: string): Promise<GraphNode> {
    await fs.mkdir(memoryDir, { recursive: true });
    const rootPath = path.join(memoryDir, GRAPH_ROOT_FILENAME);

    try {
        const existing = await fs.readFile(rootPath, "utf8");
        return graphNodeParse(GRAPH_ROOT_NODE_ID, existing);
    } catch (error) {
        if (!(error && typeof error === "object" && "code" in error && error.code === "ENOENT")) {
            throw error;
        }
    }

    const now = Date.now();
    const rootNode: GraphNode = {
        id: GRAPH_ROOT_NODE_ID,
        frontmatter: {
            title: "Memory Summary",
            description: "Structured summary of all memories",
            path: [],
            createdAt: now,
            updatedAt: now
        },
        content: "# Memory Summary\n",
        refs: []
    };

    await graphStoreWrite(memoryDir, rootNode);
    return rootNode;
}
