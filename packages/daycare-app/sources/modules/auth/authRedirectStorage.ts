const AUTH_REDIRECT_STORAGE_KEY = "daycare:auth-redirect";

let pendingRedirectPath: string | null = null;

/**
 * Persists a post-auth redirect target for invite flows.
 * Expects: path is an internal app path that starts with "/".
 */
export function authRedirectStore(path: string): void {
    const normalized = redirectPathNormalize(path);
    pendingRedirectPath = normalized;
    try {
        window.localStorage.setItem(AUTH_REDIRECT_STORAGE_KEY, normalized);
    } catch {}
}

/**
 * Reads and clears the pending post-auth redirect target.
 * Expects: called after a successful authentication flow.
 */
export function authRedirectTake(): string | null {
    let next = pendingRedirectPath;
    pendingRedirectPath = null;
    try {
        const stored = window.localStorage.getItem(AUTH_REDIRECT_STORAGE_KEY);
        window.localStorage.removeItem(AUTH_REDIRECT_STORAGE_KEY);
        next = stored || next;
    } catch {}
    return next ? redirectPathNormalize(next) : null;
}

function redirectPathNormalize(path: string): string {
    const trimmed = path.trim();
    if (!trimmed.startsWith("/") || trimmed.startsWith("//")) {
        throw new Error("Redirect path must be an internal app path.");
    }
    return trimmed;
}
