import type http from "node:http";
import { jwtSign } from "../../../utils/jwt.js";
import { APP_AUTH_SESSION_EXPIRES_IN_SECONDS } from "../appAuthLinkTool.js";
import type { AppEmailAuth } from "../appEmailAuth.js";
import { appReadJsonBody, appSendJson } from "../appHttp.js";

export type RouteAuthEmailVerifyOptions = {
    emailAuth: AppEmailAuth;
    secretResolve: () => Promise<string>;
};

/**
 * Handles POST /auth/email/verify and exchanges a Better Auth token for a Daycare app session token.
 * Expects: options.emailAuth is configured and secretResolve returns the active Daycare JWT secret.
 */
export async function routeAuthEmailVerify(
    request: http.IncomingMessage,
    response: http.ServerResponse,
    options: RouteAuthEmailVerifyOptions
): Promise<void> {
    const body = await appReadJsonBody(request);
    const token = typeof body.token === "string" ? body.token.trim() : "";
    if (!token) {
        appSendJson(response, 200, { ok: false, error: "Token is required." });
        return;
    }

    try {
        const verified = await options.emailAuth.verify(token, request.headers);
        const secret = await options.secretResolve();
        const sessionToken = await jwtSign({ userId: verified.userId }, secret, APP_AUTH_SESSION_EXPIRES_IN_SECONDS);
        appSendJson(response, 200, {
            ok: true,
            userId: verified.userId,
            token: sessionToken,
            email: verified.email,
            expiresAt: Date.now() + APP_AUTH_SESSION_EXPIRES_IN_SECONDS * 1000
        });
    } catch (error) {
        appSendJson(response, 200, {
            ok: false,
            error: error instanceof Error ? error.message : "Magic link verification failed."
        });
    }
}
