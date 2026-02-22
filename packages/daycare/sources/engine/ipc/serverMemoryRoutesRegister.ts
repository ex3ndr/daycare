import type { FastifyInstance } from "fastify";

import type { GraphNode, GraphTree } from "@/types";

type MemoryRoutesRuntime = {
    memory: {
        readGraph: (userId: string) => Promise<GraphTree>;
        readNode: (userId: string, nodeId: string) => Promise<GraphNode | null>;
    };
};

export type GraphTreeJson = {
    root: GraphNode;
    children: Record<string, GraphNode[]>;
};

/**
 * Registers engine API routes for graph-memory read access.
 * Expects: runtime.memory methods are safe for user-scoped reads.
 */
export function serverMemoryRoutesRegister(app: FastifyInstance, runtime: MemoryRoutesRuntime): void {
    app.get("/v1/engine/memory/:userId/graph", async (request, reply) => {
        const userId = ((request.params as { userId?: string }).userId ?? "").trim();
        if (!userId) {
            return reply.status(400).send({ ok: false, error: "userId is required" });
        }

        try {
            const tree = await runtime.memory.readGraph(userId);
            return reply.send({ ok: true, graph: graphTreeJsonBuild(tree) });
        } catch (error) {
            const message = error instanceof Error ? error.message : "Failed to read memory graph";
            return reply.status(500).send({ ok: false, error: message });
        }
    });

    app.get("/v1/engine/memory/:userId/node/:nodeId", async (request, reply) => {
        const params = request.params as { userId?: string; nodeId?: string };
        const userId = (params.userId ?? "").trim();
        const nodeId = (params.nodeId ?? "").trim();
        if (!userId || !nodeId) {
            return reply.status(400).send({ ok: false, error: "userId and nodeId are required" });
        }

        try {
            const node = await runtime.memory.readNode(userId, nodeId);
            if (!node) {
                return reply.status(404).send({ ok: false, error: `Node not found: ${nodeId}` });
            }
            return reply.send({ ok: true, node });
        } catch (error) {
            const message = error instanceof Error ? error.message : "Failed to read memory node";
            return reply.status(500).send({ ok: false, error: message });
        }
    });
}

/**
 * Converts graph tree maps into plain JSON objects for API responses.
 * Expects: GraphTree is already normalized by graphTreeBuild.
 */
export function graphTreeJsonBuild(tree: GraphTree): GraphTreeJson {
    const children: Record<string, GraphNode[]> = {};
    for (const [parentId, nodes] of tree.children.entries()) {
        children[parentId] = nodes;
    }
    return {
        root: tree.root,
        children
    };
}
