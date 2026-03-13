import type { DocumentChainEntry } from "../../../storage/documentChainResolve.js";

/**
 * Returns whether a memory agent may mutate the resolved document chain.
 * Expects: chain is ordered from root to target.
 */
export function documentMutationMemoryPathAllowed(chain: DocumentChainEntry[]): boolean {
    const root = chain[0];
    if (!root) {
        return false;
    }
    if (root.slug === "memory") {
        return true;
    }
    const child = chain[1];
    return root.slug === "system" && child?.slug === "memory";
}
