import { promises as fs } from "node:fs";
import path from "node:path";

import type { Context } from "@/types";
import { graphNodeParse } from "./graph/graphNodeParse.js";
import { graphRootNodeRead } from "./graph/graphRootNodeRead.js";
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

    resolveMemoryDir(ctx: Context): string {
        return path.join(this.usersDir, ctx.userId, "memory", "graph");
    }

    async readGraph(ctx: Context): Promise<GraphTree> {
        const memoryDir = this.resolveMemoryDir(ctx);
        await fs.mkdir(memoryDir, { recursive: true });
        const root = await graphRootNodeRead();
        const nodes = await graphStoreRead(memoryDir);
        nodes.push(root);
        return graphTreeBuild(nodes);
    }

    async readNode(ctx: Context, nodeId: string): Promise<GraphNode | null> {
        if (nodeId === GRAPH_ROOT_NODE_ID) {
            // Build the full tree so root.refs reflects its actual children.
            const tree = await this.readGraph(ctx);
            const childIds = (tree.children.get(GRAPH_ROOT_NODE_ID) ?? []).map((c) => c.id);
            return { ...tree.root, refs: childIds };
        }
        const memoryDir = this.resolveMemoryDir(ctx);
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

    async writeNode(ctx: Context, node: GraphNode): Promise<void> {
        const memoryDir = this.resolveMemoryDir(ctx);
        await graphStoreWrite(memoryDir, node);
    }

    async append(ctx: Context, nodeId: string, content: string): Promise<void> {
        const node = await this.readNode(ctx, nodeId);
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

        await this.writeNode(ctx, updatedNode);
    }
}
