export type AuthLinkPayload = {
    backendUrl: string;
    token: string;
};

/**
 * Decodes an auth-link hash payload into backend and token values.
 * Expects: hash contains a base64url-encoded JSON object with backendUrl and token.
 */
export function authLinkPayloadParse(hash: string): AuthLinkPayload | null {
    const encoded = hash.startsWith("#") ? hash.slice(1) : hash;
    if (!encoded) {
        authLinkPayloadInvalidLog("missing-hash-payload", encoded.length);
        return null;
    }

    const decoded = authLinkPayloadDecode(encoded);
    if (!decoded) {
        authLinkPayloadInvalidLog("invalid-base64-payload", encoded.length);
        return null;
    }

    try {
        const parsed = JSON.parse(decoded) as { backendUrl?: unknown; token?: unknown };
        if (typeof parsed.backendUrl !== "string" || typeof parsed.token !== "string") {
            authLinkPayloadInvalidLog("missing-required-fields", encoded.length);
            return null;
        }

        const backendUrl = authLinkPayloadBackendUrlNormalize(parsed.backendUrl);
        const token = parsed.token.trim();
        if (!backendUrl || !token) {
            authLinkPayloadInvalidLog("invalid-field-values", encoded.length);
            return null;
        }

        return {
            backendUrl,
            token
        };
    } catch {
        authLinkPayloadInvalidLog("invalid-json-payload", encoded.length);
        return null;
    }
}

function authLinkPayloadDecode(encoded: string): string | null {
    if (typeof atob !== "function") {
        return null;
    }

    const base64 = encoded.replaceAll("-", "+").replaceAll("_", "/");
    const paddingLength = (4 - (base64.length % 4)) % 4;
    const padded = `${base64}${"=".repeat(paddingLength)}`;

    try {
        const binary = atob(padded);
        const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
        return new TextDecoder().decode(bytes);
    } catch {
        return null;
    }
}

function authLinkPayloadBackendUrlNormalize(value: string): string | null {
    const trimmed = value.trim();
    if (!trimmed) {
        return null;
    }

    try {
        const url = new URL(trimmed);
        const pathname = url.pathname.endsWith("/") ? url.pathname.slice(0, -1) : url.pathname;
        const normalizedPathname = pathname && pathname !== "/" ? pathname : "";
        return `${url.protocol}//${url.host}${normalizedPathname}`;
    } catch {
        return null;
    }
}

function authLinkPayloadInvalidLog(reason: string, encodedLength: number): void {
    console.warn(`[daycare-app] invalid login link reason=${reason} payloadLength=${encodedLength}`);
}
