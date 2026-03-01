import type http from "node:http";
import type { DocumentsRouteContext } from "./documentsRoutes.js";

/**
 * Handles DELETE /documents/:id.
 * Soft-deletes a document if it has no active references.
 *
 * Expects: id is a valid document identifier.
 */
export async function documentsDelete(
    _request: http.IncomingMessage,
    response: http.ServerResponse,
    id: string,
    context: DocumentsRouteContext
): Promise<void> {
    try {
        const deleted = await context.documents.delete(context.ctx, id);
        if (!deleted) {
            context.sendJson(response, 404, { ok: false, error: "Document not found." });
            return;
        }
        context.sendJson(response, 200, { ok: true });
    } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to delete document.";
        context.sendJson(response, 400, { ok: false, error: message });
    }
}
