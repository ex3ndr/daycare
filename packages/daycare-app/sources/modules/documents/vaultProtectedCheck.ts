import type { VaultItem } from "./vaultsTypes";

const PROTECTED_ROOT_SLUGS = new Set(["memory", "system", "people"]);

/**
 * Checks if a document belongs to a protected subtree (memory, system, people).
 * A document is protected if it is a root with a protected slug, or if any
 * ancestor in its parent chain is such a root.
 *
 * Expects: items contains all documents for the current user.
 */
export function vaultProtectedCheck(doc: VaultItem, items: VaultItem[]): boolean {
    let current: VaultItem | undefined = doc;
    while (current) {
        if (current.parentId === null && PROTECTED_ROOT_SLUGS.has(current.slug)) {
            return true;
        }
        if (current.parentId === null) {
            return false;
        }
        current = items.find((d) => d.id === current!.parentId);
    }
    return false;
}
