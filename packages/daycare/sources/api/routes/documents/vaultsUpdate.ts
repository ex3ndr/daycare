import type http from "node:http";
import { peopleVaultFrontmatterAssert } from "../../../engine/people/peopleVaultFrontmatterAssert.js";
import type { VaultsRouteContext } from "./vaultsRoutes.js";

/**
 * Handles POST /vault/:id/update.
 * Updates a vault entry's fields including optional reparenting.
 *
 * Expects: id is a valid vault identifier; JSON body with optional { slug, title, description, body, parentId }.
 */
export async function vaultsUpdate(
    request: http.IncomingMessage,
    response: http.ServerResponse,
    id: string,
    context: VaultsRouteContext
): Promise<void> {
    const body = await context.readJsonBody(request);
    const existing = await context.documents.findById(context.ctx, id);

    const input: Record<string, unknown> = {};
    if (typeof body.slug === "string") input.slug = body.slug;
    if (typeof body.title === "string") input.title = body.title;
    if (typeof body.description === "string") input.description = body.description;
    if (typeof body.body === "string") input.body = body.body;
    if (body.parentId === null || typeof body.parentId === "string") input.parentId = body.parentId;

    try {
        if (existing) {
            const currentParentId = await context.documents.findParentId(context.ctx, id);
            const nextParentIdRaw =
                body.parentId === null ? null : typeof body.parentId === "string" ? body.parentId.trim() : undefined;
            const nextParentId = nextParentIdRaw === undefined ? currentParentId : nextParentIdRaw || null;
            const nextBody = typeof body.body === "string" ? body.body : existing.body;

            await peopleVaultFrontmatterAssert({
                ctx: context.ctx,
                documents: context.documents,
                parentId: nextParentId,
                body: nextBody
            });
        }

        const doc = await context.documents.update(context.ctx, id, {
            ...input,
            updatedAt: Date.now()
        });

        const parentId = await context.documents.findParentId(context.ctx, doc.id);

        context.sendJson(response, 200, {
            ok: true,
            item: {
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
        const message = err instanceof Error ? err.message : "Failed to update vault entry.";
        context.sendJson(response, 400, { ok: false, error: message });
    }
}
