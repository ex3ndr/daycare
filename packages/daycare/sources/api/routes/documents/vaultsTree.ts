import type http from "node:http";
import type { VaultDbRecord } from "../../../storage/databaseTypes.js";
import type { VaultsRouteContext } from "./vaultsRoutes.js";

type VaultTreeItem = {
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
 * Handles GET /vault/tree.
 * Returns all active vault entries as a flat array with parentId resolved.
 *
 * Expects: authenticated context with documents repository.
 */
export async function vaultsTree(
    _request: http.IncomingMessage,
    response: http.ServerResponse,
    context: VaultsRouteContext
): Promise<void> {
    const items: VaultTreeItem[] = [];
    const roots = await context.documents.findRoots(context.ctx);

    async function collectChildren(parentId: string): Promise<void> {
        const children = await context.documents.findChildren(context.ctx, parentId);
        for (const child of children) {
            items.push(vaultTreeItemBuild(child, parentId));
            await collectChildren(child.id);
        }
    }

    for (const root of roots) {
        items.push(vaultTreeItemBuild(root, null));
        await collectChildren(root.id);
    }

    context.sendJson(response, 200, { ok: true, items });
}

function vaultTreeItemBuild(doc: VaultDbRecord, parentId: string | null): VaultTreeItem {
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
