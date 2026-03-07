export type WorkspaceInviteLinkPayload = {
    backendUrl: string;
    token: string;
    kind: "workspace-invite";
    workspaceName?: string;
};

export type WorkspaceInviteUrlBuildInput = {
    appEndpoint: string;
    backendUrl: string;
    token: string;
    workspaceName?: string;
};

/**
 * Builds a workspace invite URL for the app invite screen.
 * Expects: appEndpoint and backendUrl are absolute endpoint URLs.
 */
export function workspaceInviteUrlBuild(input: WorkspaceInviteUrlBuildInput): string {
    const appEndpoint = endpointNormalize(input.appEndpoint, "appEndpoint");
    const backendUrl = endpointNormalize(input.backendUrl, "backendUrl");
    const token = input.token.trim();
    if (!token) {
        throw new Error("token is required.");
    }

    const payload: WorkspaceInviteLinkPayload = {
        backendUrl,
        token,
        kind: "workspace-invite",
        ...(input.workspaceName?.trim() ? { workspaceName: input.workspaceName.trim() } : {})
    };

    const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
    return `${appEndpoint}/invite#${encoded}`;
}

function endpointNormalize(value: string, fieldName: string): string {
    const trimmed = value.trim();
    if (!trimmed) {
        throw new Error(`${fieldName} is required.`);
    }

    const parsed = new URL(trimmed);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
        throw new Error(`${fieldName} must be an endpoint URL.`);
    }

    const pathname = parsed.pathname.replace(/\/+$/, "");
    const normalizedPathname = pathname && pathname !== "/" ? pathname : "";
    if (parsed.search || parsed.hash) {
        throw new Error(`${fieldName} must not include query params or hash.`);
    }

    return `${parsed.protocol}//${parsed.host}${normalizedPathname}`;
}
