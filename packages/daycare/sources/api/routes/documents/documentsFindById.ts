import type http from "node:http";
import type { DocumentsRouteContext } from "./documentsRoutes.js";

/**
 * Handles GET /documents/:id.
 * Returns a single document with its parentId resolved.
 *
 * Expects: id is a valid document identifier.
 */
export async function documentsFindById(
    _request: http.IncomingMessage,
    response: http.ServerResponse,
    id: string,
    context: DocumentsRouteContext
): Promise<void> {
    const doc = await context.documents.findById(context.ctx, id);
    if (!doc) {
        context.sendJson(response, 404, { ok: false, error: "Document not found." });
        return;
    }

    const parentId = await context.documents.findParentId(context.ctx, id);

    context.sendJson(response, 200, {
        ok: true,
        document: {
            id: doc.id,
            slug: doc.slug,
            title: doc.title,
            description: doc.description,
            body: doc.body,
            parentId,
            createdAt: doc.createdAt,
            updatedAt: doc.updatedAt
        }
    });
}
