import { promises as fs } from "node:fs";
import path from "node:path";

import { UserHome } from "../users/userHome.js";
import { graphNodeParse } from "./graph/graphNodeParse.js";
import { graphStoreEnsureRoot } from "./graph/graphStoreEnsureRoot.js";
import { graphStoreRead } from "./graph/graphStoreRead.js";
import { graphStoreWrite } from "./graph/graphStoreWrite.js";
import { graphTreeBuild } from "./graph/graphTreeBuild.js";
import { GRAPH_ROOT_NODE_ID, type GraphNode, type GraphTree } from "./graph/graphTypes.js";

export type MemoryOptions = {
    usersDir: string;
};

/**
 * Facade for user-scoped graph-memory markdown storage.
 * Expects: usersDir points to the runtime users root.
 */
export class Memory {
    private readonly usersDir: string;

    constructor(options: MemoryOptions) {
        this.usersDir = options.usersDir;
    }

    resolveMemoryDir(userId: string): string {
        return path.join(new UserHome(this.usersDir, userId).memory, "graph");
    }

    async readGraph(userId: string): Promise<GraphTree> {
        const memoryDir = this.resolveMemoryDir(userId);
        const root = await graphStoreEnsureRoot(memoryDir);
        const nodes = await graphStoreRead(memoryDir);
        if (!nodes.some((node) => node.id === GRAPH_ROOT_NODE_ID)) {
            nodes.push(root);
        }
        return graphTreeBuild(nodes);
    }

    async readNode(userId: string, nodeId: string): Promise<GraphNode | null> {
        const memoryDir = this.resolveMemoryDir(userId);
        if (nodeId === GRAPH_ROOT_NODE_ID) {
            return graphStoreEnsureRoot(memoryDir);
        }
        const filename = `${nodeId}.md`;
        const filePath = path.join(memoryDir, filename);

        try {
            const raw = await fs.readFile(filePath, "utf8");
            return graphNodeParse(nodeId, raw);
        } catch (error) {
            if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") {
                return null;
            }
            throw error;
        }
    }

    async writeNode(userId: string, node: GraphNode): Promise<void> {
        const memoryDir = this.resolveMemoryDir(userId);
        await graphStoreWrite(memoryDir, node);
    }

    async append(userId: string, nodeId: string, content: string): Promise<void> {
        const node = await this.readNode(userId, nodeId);
        if (!node) {
            throw new Error(`Memory node not found: ${nodeId}`);
        }

        const separator = node.content.length === 0 || node.content.endsWith("\n") ? "" : "\n";
        const updatedNode: GraphNode = {
            ...node,
            frontmatter: {
                ...node.frontmatter,
                updatedAt: Date.now()
            },
            content: `${node.content}${separator}${content}`
        };

        await this.writeNode(userId, updatedNode);
    }
}
