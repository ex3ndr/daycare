import type http from "node:http";
import type { DocumentsRouteContext } from "./documentsRoutes.js";

/**
 * Handles POST /documents.
 * Creates a new document with optional parentId.
 *
 * Expects: JSON body with { id, slug, title, description?, body?, parentId? }.
 */
export async function documentsCreate(
    request: http.IncomingMessage,
    response: http.ServerResponse,
    context: DocumentsRouteContext
): Promise<void> {
    const body = await context.readJsonBody(request);

    const id = typeof body.id === "string" ? body.id.trim() : "";
    const slug = typeof body.slug === "string" ? body.slug.trim() : "";
    const title = typeof body.title === "string" ? body.title.trim() : "";
    const description = typeof body.description === "string" ? body.description.trim() : "";
    const docBody = typeof body.body === "string" ? body.body : "";
    const parentId = typeof body.parentId === "string" ? body.parentId.trim() || null : null;

    if (!id || !slug || !title) {
        context.sendJson(response, 400, { ok: false, error: "Fields id, slug, and title are required." });
        return;
    }

    try {
        const now = Date.now();
        const doc = await context.documents.create(context.ctx, {
            id,
            slug,
            title,
            description,
            body: docBody,
            createdAt: now,
            updatedAt: now,
            parentId
        });

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
        const message = err instanceof Error ? err.message : "Failed to create document.";
        context.sendJson(response, 400, { ok: false, error: message });
    }
}
