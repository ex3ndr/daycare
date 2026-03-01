/**
 * Generates a URL-friendly slug from a document title.
 * Lowercases, replaces spaces/special chars with hyphens, removes duplicates.
 *
 * Expects: title is a non-empty string.
 */
export function documentSlugGenerate(title: string): string {
    return title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .replace(/-{2,}/g, "-");
}
