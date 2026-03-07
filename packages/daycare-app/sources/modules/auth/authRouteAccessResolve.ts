import { authLinkPayloadFromUrl } from "@/modules/auth/authLinkPayloadFromUrl";
import type { AuthState } from "@/modules/auth/authStoreCreate";

/**
 * Resolves which app route groups must stay accessible for the current auth state and deep link.
 * Expects: authUrl is the full current URL or null when no auth deep link is active.
 */
export function authRouteAccessResolve(
    authState: AuthState,
    authUrl: string | null | undefined
): {
    allowApp: boolean;
    allowAuth: boolean;
} {
    const hasIncomingAuthLink = authLinkPayloadFromUrl(authUrl) !== null;

    return {
        allowApp: authState === "authenticated",
        allowAuth: authState === "unauthenticated" || hasIncomingAuthLink
    };
}
