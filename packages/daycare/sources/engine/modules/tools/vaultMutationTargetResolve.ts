import type { Context } from "@/types";
import type { VaultDbRecord } from "../../../storage/databaseTypes.js";
import { vaultPathFind } from "../../../storage/vaultPathFind.js";

type VaultMutationTargetResolveInput = {
    vaultId?: string;
    path?: string;
};

type VaultMutationTargetResolveRepo = {
    findById: (ctx: Context, id: string) => Promise<VaultDbRecord | null>;
    findBySlugAndParent: (ctx: Context, slug: string, parentId: string | null) => Promise<{ id: string } | null>;
};

/**
 * Resolves a mutation target vault entry from an explicit id or `vault://...` path.
 * Expects: exactly one selector is provided and points to an existing vault entry.
 */
export async function vaultMutationTargetResolve(
    ctx: Context,
    input: VaultMutationTargetResolveInput,
    documents: VaultMutationTargetResolveRepo
): Promise<VaultDbRecord> {
    const vaultId = input.vaultId?.trim();
    const path = input.path?.trim();
    if (vaultId && path) {
        throw new Error("Provide either vaultId or path, not both.");
    }
    if (!vaultId && !path) {
        throw new Error("Provide either vaultId or path.");
    }

    let targetDocumentId = vaultId ?? null;
    if (!targetDocumentId && path) {
        if (path === "vault://") {
            throw new Error("Path must point to a vault entry, not the root listing.");
        }
        targetDocumentId = await vaultPathFind(ctx, path, documents);
        if (!targetDocumentId) {
            throw new Error(`Vault entry not found for path: ${path}`);
        }
    }
    if (!targetDocumentId) {
        throw new Error("Vault target is required.");
    }

    const document = await documents.findById(ctx, targetDocumentId);
    if (!document) {
        throw new Error(`Vault entry not found: ${targetDocumentId}`);
    }

    return document;
}
