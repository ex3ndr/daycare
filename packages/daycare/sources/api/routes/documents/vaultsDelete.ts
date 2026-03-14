import type http from "node:http";
import type { VaultsRouteContext } from "./vaultsRoutes.js";

/**
 * Handles POST /vault/:id/delete.
 * Soft-deletes a vault entry if it has no active references.
 *
 * Expects: id is a valid vault identifier.
 */
export async function vaultsDelete(
    _request: http.IncomingMessage,
    response: http.ServerResponse,
    id: string,
    context: VaultsRouteContext
): Promise<void> {
    try {
        const deleted = await context.documents.delete(context.ctx, id);
        if (!deleted) {
            context.sendJson(response, 404, { ok: false, error: "Vault entry not found." });
            return;
        }
        context.sendJson(response, 200, { ok: true });
    } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to delete vault entry.";
        context.sendJson(response, 400, { ok: false, error: message });
    }
}
