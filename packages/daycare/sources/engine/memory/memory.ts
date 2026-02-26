import { promises as fs } from "node:fs";
import path from "node:path";

import type { Context } from "@/types";
import { graphNodeChangeDetect } from "./graph/graphNodeChangeDetect.js";
import { graphNodeParse } from "./graph/graphNodeParse.js";
import { graphRootNodeRead } from "./graph/graphRootNodeRead.js";
import { graphStoreRead } from "./graph/graphStoreRead.js";
import { graphStoreWrite } from "./graph/graphStoreWrite.js";
import { graphTreeBuild } from "./graph/graphTreeBuild.js";
import { GRAPH_ROOT_NODE_ID, type GraphNode, type GraphNodeVersion, type GraphTree } from "./graph/graphTypes.js";
import { graphVersionRead } from "./graph/graphVersionRead.js";
import { graphVersionWrite } from "./graph/graphVersionWrite.js";

export type MemoryOptions = {
    usersDir: string;
};

export type WriteNodeOptions = {
    changeDescription?: string;
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

    async writeNode(ctx: Context, node: GraphNode, options: WriteNodeOptions = {}): Promise<GraphNode> {
        if (node.id === GRAPH_ROOT_NODE_ID) {
            throw new Error("Root node is virtual and cannot be written to disk.");
        }

        const memoryDir = this.resolveMemoryDir(ctx);
        const existing = await this.readNode(ctx, node.id);
        const existingVersion = existing ? Math.max(existing.frontmatter.version, 1) : 1;
        const normalizedNode: GraphNode = {
            ...node,
            frontmatter: {
                ...node.frontmatter,
                version: existing ? existingVersion : 1
            }
        };

        const changeDescription = options.changeDescription?.trim();
        if (existing && changeDescription) {
            const changed = graphNodeChangeDetect(existing, normalizedNode);
            if (changed) {
                await graphVersionWrite(memoryDir, existing, changeDescription);
                normalizedNode.frontmatter.version = existingVersion + 1;
            }
        }

        await graphStoreWrite(memoryDir, normalizedNode);
        return normalizedNode;
    }

    async append(ctx: Context, nodeId: string, content: string, changeDescription?: string): Promise<void> {
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

        await this.writeNode(ctx, updatedNode, { changeDescription });
    }

    async readNodeVersions(ctx: Context, nodeId: string): Promise<GraphNodeVersion[]> {
        const memoryDir = this.resolveMemoryDir(ctx);
        return graphVersionRead(memoryDir, nodeId);
    }
}
