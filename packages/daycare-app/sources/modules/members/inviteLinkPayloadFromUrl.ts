import type { InviteLinkPayload } from "./inviteLinkPayloadParse";
import { inviteLinkPayloadParse } from "./inviteLinkPayloadParse";

/**
 * Extracts a workspace invite payload from a full URL, payload query, or raw hash.
 * Expects: url may be absolute, relative, or hash-only.
 */
export function inviteLinkPayloadFromUrl(url: string | null | undefined): InviteLinkPayload | null {
    const rawUrl = typeof url === "string" ? url.trim() : "";
    if (!rawUrl) {
        return null;
    }

    if (rawUrl.startsWith("#")) {
        return inviteLinkPayloadParse(rawUrl);
    }

    const parsed = urlParse(rawUrl);
    if (!parsed) {
        return null;
    }

    const hashPayload = parsed.hash.startsWith("#") ? parsed.hash.slice(1) : parsed.hash;
    if (hashPayload) {
        const payload = inviteLinkPayloadParse(`#${hashPayload}`);
        if (payload) {
            return payload;
        }
    }

    const queryPayload = parsed.searchParams.get("payload");
    if (queryPayload) {
        const payload = inviteLinkPayloadParse(`#${queryPayload}`);
        if (payload) {
            return payload;
        }
    }

    const backendUrl = parsed.searchParams.get("backendUrl")?.trim() ?? "";
    const token = parsed.searchParams.get("token")?.trim() ?? "";
    const workspaceName = parsed.searchParams.get("workspaceName")?.trim() ?? "";
    if (!backendUrl || !token || parsed.searchParams.get("kind") !== "workspace-invite") {
        return null;
    }

    return {
        backendUrl,
        token,
        kind: "workspace-invite",
        ...(workspaceName ? { workspaceName } : {})
    };
}

function urlParse(rawUrl: string): URL | null {
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
