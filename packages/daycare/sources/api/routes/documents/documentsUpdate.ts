import type http from "node:http";
import type { DocumentsRouteContext } from "./documentsRoutes.js";

/**
 * Handles PUT /documents/:id.
 * Updates a document's fields including optional reparenting.
 *
 * Expects: id is a valid document identifier; JSON body with optional { slug, title, description, body, parentId }.
 */
export async function documentsUpdate(
    request: http.IncomingMessage,
    response: http.ServerResponse,
    id: string,
    context: DocumentsRouteContext
): Promise<void> {
    const body = await context.readJsonBody(request);

    const input: Record<string, unknown> = {};
    if (typeof body.slug === "string") input.slug = body.slug;
    if (typeof body.title === "string") input.title = body.title;
    if (typeof body.description === "string") input.description = body.description;
    if (typeof body.body === "string") input.body = body.body;
    if (body.parentId === null || typeof body.parentId === "string") input.parentId = body.parentId;

    try {
        const doc = await context.documents.update(context.ctx, id, {
            ...input,
            updatedAt: Date.now()
        });

        const parentId = await context.documents.findParentId(context.ctx, doc.id);

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
    } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to update document.";
        context.sendJson(response, 400, { ok: false, error: message });
    }
}
