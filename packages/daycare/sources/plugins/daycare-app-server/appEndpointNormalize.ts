/**
 * Normalizes app/server endpoint configuration to origin format.
 * Returns undefined for blank input, trims trailing slash, and rejects non-http(s) or non-origin URLs.
 *
 * Expects: value is an absolute endpoint URL when provided.
 */
export function appEndpointNormalize(value: string | undefined, fieldName: string): string | undefined {
    const trimmed = value?.trim();
    if (!trimmed) {
        return undefined;
    }

    let parsed: URL;
    try {
        parsed = new URL(trimmed);
    } catch {
        throw new Error(`${fieldName} must be an endpoint URL (for example: https://app.example.com).`);
    }

    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        throw new Error(`${fieldName} must use http:// or https://.`);
    }

    if (parsed.search || parsed.hash) {
        throw new Error(`${fieldName} must not include query params or hash.`);
    }

    const pathname = parsed.pathname.replace(/\/+$/, "");
    if (pathname.length > 0) {
        throw new Error(`${fieldName} must not include a path.`);
    }

    return `${parsed.protocol}//${parsed.host}`;
}
