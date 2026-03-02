import type { AuthLinkPayload } from "@/modules/auth/authLinkPayloadParse";
import { authLinkPayloadParse } from "@/modules/auth/authLinkPayloadParse";

/**
 * Extracts auth payload from a full URL or raw hash for native and web auth flows.
 * Expects: url may be absolute, relative, or hash-only; query payload uses ?payload=<base64url>.
 */
export function authLinkPayloadFromUrl(url: string | null | undefined): AuthLinkPayload | null {
    const rawUrl = typeof url === "string" ? url.trim() : "";
    if (!rawUrl) {
        return null;
    }

    if (rawUrl.startsWith("#")) {
        return authLinkPayloadParse(rawUrl);
    }

    const parsed = authLinkPayloadUrlParse(rawUrl);
    if (!parsed) {
        return null;
    }

    const hashPayload = parsed.hash.startsWith("#") ? parsed.hash.slice(1) : parsed.hash;
    if (hashPayload) {
        const payload = authLinkPayloadParse(`#${hashPayload}`);
        if (payload) {
            return payload;
        }
    }

    const queryPayload = parsed.searchParams.get("payload");
    if (!queryPayload) {
        return null;
    }
    return authLinkPayloadParse(`#${queryPayload}`);
}

function authLinkPayloadUrlParse(rawUrl: string): URL | null {
    try {
        return new URL(rawUrl);
    } catch {
        try {
            return new URL(rawUrl, "https://daycare.local");
        } catch {
            return null;
        }
    }
}
