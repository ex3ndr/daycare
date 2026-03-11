/**
 * Normalizes a mini-app id and rejects values that are unsafe for URLs or filesystem paths.
 * Expects: ids are stable lowercase slugs like "crm" or "team-dashboard".
 */
export function miniAppIdNormalize(value: string): string {
    const normalized = value.trim().toLowerCase();
    if (!normalized) {
        throw new Error("Mini app id is required.");
    }
    if (!/^[a-z0-9][a-z0-9-]*$/.test(normalized)) {
        throw new Error("Mini app id must use lowercase letters, numbers, and hyphens only.");
    }
    return normalized;
}
