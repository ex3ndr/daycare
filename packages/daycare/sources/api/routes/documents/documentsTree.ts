import type http from "node:http";
import type { DocumentDbRecord } from "../../../storage/databaseTypes.js";
import type { DocumentsRouteContext } from "./documentsRoutes.js";

type DocumentTreeItem = {
    id: string;
    slug: string;
    title: string;
    description: string;
    body: string;
    parentId: string | null;
    createdAt: number;
    updatedAt: number;
};

/**
 * Handles GET /documents/tree.
 * Returns all active documents as a flat array with parentId resolved.
 *
 * Expects: authenticated context with documents repository.
 */
export async function documentsTree(
    _request: http.IncomingMessage,
    response: http.ServerResponse,
    context: DocumentsRouteContext
): Promise<void> {
    const items: DocumentTreeItem[] = [];
    const roots = await context.documents.findRoots(context.ctx);

    async function collectChildren(parentId: string): Promise<void> {
        const children = await context.documents.findChildren(context.ctx, parentId);
        for (const child of children) {
            items.push(documentTreeItemBuild(child, parentId));
            await collectChildren(child.id);
        }
    }

    for (const root of roots) {
        items.push(documentTreeItemBuild(root, null));
        await collectChildren(root.id);
    }

    context.sendJson(response, 200, { ok: true, items });
}

function documentTreeItemBuild(doc: DocumentDbRecord, parentId: string | null): DocumentTreeItem {
    return {
        id: doc.id,
        slug: doc.slug,
        title: doc.title,
        description: doc.description,
        body: doc.body,
        parentId,
        createdAt: doc.createdAt,
        updatedAt: doc.updatedAt
    };
}
