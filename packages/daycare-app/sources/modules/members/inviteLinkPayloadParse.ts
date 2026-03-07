export type InviteLinkPayload = {
    backendUrl: string;
    token: string;
    kind: "workspace-invite";
    workspaceName?: string;
};

/**
 * Decodes a workspace invite-link payload from a base64url hash or payload query value.
 * Expects: payload JSON includes backendUrl, token, and kind="workspace-invite".
 */
export function inviteLinkPayloadParse(hash: string): InviteLinkPayload | null {
    const encoded = hash.startsWith("#") ? hash.slice(1) : hash;
    if (!encoded) {
        return null;
    }

    const decoded = base64UrlDecode(encoded);
    if (!decoded) {
        return null;
    }

    try {
        const parsed = JSON.parse(decoded) as {
            backendUrl?: unknown;
            token?: unknown;
            kind?: unknown;
            workspaceName?: unknown;
        };
        const backendUrl = endpointNormalize(parsed.backendUrl);
        const token = typeof parsed.token === "string" ? parsed.token.trim() : "";
        const workspaceName = typeof parsed.workspaceName === "string" ? parsed.workspaceName.trim() : "";
        if (!backendUrl || !token || parsed.kind !== "workspace-invite") {
            return null;
        }
        return {
            backendUrl,
            token,
            kind: "workspace-invite",
            ...(workspaceName ? { workspaceName } : {})
        };
    } catch {
        return null;
    }
}

function base64UrlDecode(encoded: string): string | null {
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

function endpointNormalize(value: unknown): string | null {
    if (typeof value !== "string") {
        return null;
    }
    const trimmed = value.trim();
    if (!trimmed) {
        return null;
    }
    try {
        const parsed = new URL(trimmed);
        const pathname = parsed.pathname.endsWith("/") ? parsed.pathname.slice(0, -1) : parsed.pathname;
        const normalizedPathname = pathname && pathname !== "/" ? pathname : "";
        return `${parsed.protocol}//${parsed.host}${normalizedPathname}`;
    } catch {
        return null;
    }
}
