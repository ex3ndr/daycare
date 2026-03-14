import type http from "node:http";
import type { VaultsRouteContext } from "./vaultsRoutes.js";

/**
 * Handles GET /vault/:id/history.
 * Returns all versions of a vault entry ordered by version descending.
 *
 * Expects: id is a valid vault identifier.
 */
export async function vaultsHistory(
    _request: http.IncomingMessage,
    response: http.ServerResponse,
    id: string,
    context: VaultsRouteContext
): Promise<void> {
    const versions = await context.documents.findHistory(context.ctx, id);
    if (versions.length === 0) {
        context.sendJson(response, 404, { ok: false, error: "Vault entry not found." });
        return;
    }

    context.sendJson(response, 200, {
        ok: true,
        versions: versions.map((v) => ({
            version: v.version ?? 1,
            title: v.title,
            body: v.body,
            description: v.description,
            slug: v.slug,
            createdAt: v.createdAt,
            updatedAt: v.updatedAt,
            validFrom: v.validFrom ?? v.createdAt,
            validTo: v.validTo ?? null
        }))
    });
}
