import type { VaultItem } from "./vaultsTypes";

/**
 * Resolves the root `vault://vault` id from the loaded document list.
 * Expects: items contains all documents for the current user.
 */
export function vaultRootIdResolve(items: VaultItem[]): string | null {
    const root = items.find((item) => item.slug === "document" && item.parentId === null);
    return root?.id ?? null;
}
