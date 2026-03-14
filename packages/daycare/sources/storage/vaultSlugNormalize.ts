/**
 * Normalizes and validates a document slug used in `vault://...` paths.
 * Expects: caller passes raw user input; returns a trimmed, path-safe segment.
 */
export function vaultSlugNormalize(slug: string): string {
    const normalized = slug.trim();
    if (!normalized) {
        throw new Error("Vault slug is required.");
    }
    if (normalized.includes("/")) {
        throw new Error("Vault slug cannot contain '/'.");
    }
    return normalized;
}
