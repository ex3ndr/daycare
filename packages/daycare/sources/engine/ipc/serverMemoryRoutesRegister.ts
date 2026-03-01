import type { FastifyInstance } from "fastify";

import { type Context, contextForUser } from "../agents/context.js";

type DocumentRecord = {
    id: string;
    title: string;
    description: string;
    body: string;
    version?: number;
    createdAt: number;
    updatedAt: number;
};

type DocumentReferenceRecord = {
    kind: "parent" | "link" | "body";
    targetId: string;
};

type MemoryRoutesRuntime = {
    storage: {
        documents: {
            findById: (ctx: Context, id: string) => Promise<DocumentRecord | null>;
            findBySlugAndParent: (
                ctx: Context,
                slug: string,
                parentId: string | null
            ) => Promise<{ id: string } | null>;
            findChildren: (ctx: Context, parentId: string | null) => Promise<DocumentRecord[]>;
            findReferences: (ctx: Context, id: string) => Promise<DocumentReferenceRecord[]>;
            findParentId: (ctx: Context, id: string) => Promise<string | null>;
        };
    };
};

export type GraphNode = {
    id: string;
    frontmatter: {
        title: string;
        description: string;
        parents: string[];
        version: number;
        createdAt: number;
        updatedAt: number;
    };
    content: string;
    refs: string[];
};

export type GraphTreeJson = {
    root: GraphNode;
    children: Record<string, GraphNode[]>;
};

type GraphTreeRuntime = {
    root: GraphNode;
    children: Map<string, GraphNode[]>;
};

type MemoryGraphScope = "memory" | "documents";

const DOCUMENTS_ROOT_NODE_ID = "__documents_root__";

/**
 * Registers engine API routes for memory graph read access backed by documents.
 * Expects: runtime.storage documents repository is available.
 */
export function serverMemoryRoutesRegister(app: FastifyInstance, runtime: MemoryRoutesRuntime): void {
    app.get("/v1/engine/memory/:userId/graph", async (request, reply) => {
        const userId = ((request.params as { userId?: string }).userId ?? "").trim();
        if (!userId) {
            return reply.status(400).send({ ok: false, error: "userId is required" });
        }

        const scope = memoryGraphScopeResolve((request.query as { scope?: string }).scope);
        if (!scope) {
            return reply.status(400).send({ ok: false, error: "scope must be either 'memory' or 'documents'" });
        }

        try {
            const ctx = contextForUser({ userId });
            const tree =
                scope === "documents"
                    ? await documentsTreeBuild(ctx, runtime.storage.documents)
                    : await memoryGraphTreeBuild(ctx, runtime.storage.documents);
            return reply.send({ ok: true, graph: graphTreeJsonBuild(tree) });
        } catch (error) {
            const message = error instanceof Error ? error.message : "Failed to read memory graph";
            if (message === "Memory root document not found") {
                return reply.status(404).send({ ok: false, error: message });
            }
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

        const scope = memoryGraphScopeResolve((request.query as { scope?: string }).scope);
        if (!scope) {
            return reply.status(400).send({ ok: false, error: "scope must be either 'memory' or 'documents'" });
        }

        try {
            const ctx = contextForUser({ userId });
            if (scope === "documents") {
                if (nodeId === DOCUMENTS_ROOT_NODE_ID) {
                    return reply.send({ ok: true, node: documentsRootNodeBuild() });
                }
                const node = await graphNodeBuild(ctx, nodeId, runtime.storage.documents);
                if (!node) {
                    return reply.status(404).send({ ok: false, error: `Node not found: ${nodeId}` });
                }
                return reply.send({ ok: true, node });
            }

            const memoryRoot = await runtime.storage.documents.findBySlugAndParent(ctx, "memory", null);
            if (!memoryRoot) {
                return reply.status(404).send({ ok: false, error: "Memory root document not found" });
            }
            const targetId = nodeId === "__root__" ? memoryRoot.id : nodeId;
            const inTree = await memoryNodeInTreeIs(ctx, targetId, memoryRoot.id, runtime.storage.documents);
            if (!inTree) {
                return reply.status(404).send({ ok: false, error: `Node not found: ${nodeId}` });
            }

            const node = await graphNodeBuild(ctx, targetId, runtime.storage.documents);
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
 * Expects: tree children map is keyed by parent id.
 */
export function graphTreeJsonBuild(tree: GraphTreeRuntime): GraphTreeJson {
    const children: Record<string, GraphNode[]> = {};
    for (const [parentId, nodes] of tree.children.entries()) {
        children[parentId] = nodes;
    }
    return {
        root: tree.root,
        children
    };
}

async function memoryGraphTreeBuild(
    ctx: Context,
    documents: MemoryRoutesRuntime["storage"]["documents"]
): Promise<GraphTreeRuntime> {
    const memoryRoot = await documents.findBySlugAndParent(ctx, "memory", null);
    if (!memoryRoot) {
        throw new Error("Memory root document not found");
    }
    return memoryTreeBuild(ctx, memoryRoot.id, documents);
}

async function documentsTreeBuild(
    ctx: Context,
    documents: MemoryRoutesRuntime["storage"]["documents"]
): Promise<GraphTreeRuntime> {
    const root = documentsRootNodeBuild();
    const children = new Map<string, GraphNode[]>();
    const visited = new Set<string>();

    const walk = async (parentId: string | null, graphParentId: string): Promise<void> => {
        if (parentId && visited.has(parentId)) {
            return;
        }
        if (parentId) {
            visited.add(parentId);
        }

        const docs = await documents.findChildren(ctx, parentId);
        const nodes: GraphNode[] = [];
        for (const doc of docs) {
            const node = await graphNodeBuild(ctx, doc.id, documents, parentId);
            if (!node) {
                continue;
            }
            nodes.push(node);
        }
        children.set(graphParentId, nodes);

        for (const node of nodes) {
            await walk(node.id, node.id);
        }
    };

    await walk(null, root.id);
    return { root, children };
}

async function memoryTreeBuild(
    ctx: Context,
    rootId: string,
    documents: MemoryRoutesRuntime["storage"]["documents"]
): Promise<GraphTreeRuntime> {
    const root = await graphNodeBuild(ctx, rootId, documents);
    if (!root) {
        throw new Error("Memory root document is missing.");
    }

    const children = new Map<string, GraphNode[]>();
    const visited = new Set<string>();

    const walk = async (parentId: string): Promise<void> => {
        if (visited.has(parentId)) {
            return;
        }
        visited.add(parentId);

        const docs = await documents.findChildren(ctx, parentId);
        const nodes: GraphNode[] = [];
        for (const doc of docs) {
            const node = await graphNodeBuild(ctx, doc.id, documents, parentId);
            if (!node) {
                continue;
            }
            nodes.push(node);
        }
        children.set(parentId, nodes);

        for (const node of nodes) {
            await walk(node.id);
        }
    };

    await walk(root.id);

    return { root, children };
}

async function graphNodeBuild(
    ctx: Context,
    id: string,
    documents: MemoryRoutesRuntime["storage"]["documents"],
    parentId?: string | null
): Promise<GraphNode | null> {
    const document = await documents.findById(ctx, id);
    if (!document) {
        return null;
    }

    const refs = await documents.findReferences(ctx, id);
    const parent = parentId === undefined ? await documents.findParentId(ctx, id) : parentId;

    return {
        id: document.id,
        frontmatter: {
            title: document.title,
            description: document.description,
            parents: parent ? [parent] : [],
            version: document.version ?? 1,
            createdAt: document.createdAt,
            updatedAt: document.updatedAt
        },
        content: document.body,
        refs: graphNodeRefsBuild(refs)
    };
}

function graphNodeRefsBuild(refs: DocumentReferenceRecord[]): string[] {
    const resolved = new Set<string>();
    for (const ref of refs) {
        if (ref.kind === "parent") {
            continue;
        }
        resolved.add(ref.targetId);
    }
    return Array.from(resolved);
}

async function memoryNodeInTreeIs(
    ctx: Context,
    nodeId: string,
    rootId: string,
    documents: MemoryRoutesRuntime["storage"]["documents"]
): Promise<boolean> {
    if (nodeId === rootId) {
        return true;
    }

    const node = await documents.findById(ctx, nodeId);
    if (!node) {
        return false;
    }

    const visited = new Set<string>();
    let currentId: string | null = node.id;
    while (currentId) {
        if (visited.has(currentId)) {
            return false;
        }
        visited.add(currentId);

        const parentId = await documents.findParentId(ctx, currentId);
        if (!parentId) {
            return false;
        }
        if (parentId === rootId) {
            return true;
        }
        currentId = parentId;
    }

    return false;
}

function documentsRootNodeBuild(): GraphNode {
    return {
        id: DOCUMENTS_ROOT_NODE_ID,
        frontmatter: {
            title: "Documents",
            description: "Virtual root that groups top-level documents.",
            parents: [],
            version: 1,
            createdAt: 0,
            updatedAt: 0
        },
        content: "",
        refs: []
    };
}

function memoryGraphScopeResolve(scope: string | undefined): MemoryGraphScope | null {
    if (!scope || scope === "memory") {
        return "memory";
    }
    if (scope === "documents") {
        return "documents";
    }
    return null;
}
