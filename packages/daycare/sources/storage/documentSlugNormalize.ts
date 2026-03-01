/**
 * Normalizes and validates a document slug used in `~/...` paths.
 * Expects: caller passes raw user input; returns a trimmed, path-safe segment.
 */
export function documentSlugNormalize(slug: string): string {
    const normalized = slug.trim();
    if (!normalized) {
        throw new Error("Document slug is required.");
    }
    if (normalized.includes("/")) {
        throw new Error("Document slug cannot contain '/'.");
    }
    return normalized;
}
