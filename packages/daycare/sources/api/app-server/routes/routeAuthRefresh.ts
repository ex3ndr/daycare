import type http from "node:http";
import { jwtSign, jwtVerify } from "../../../utils/jwt.js";
import { APP_AUTH_LINK_SERVICE, APP_AUTH_SESSION_EXPIRES_IN_SECONDS } from "../appAuthLinkTool.js";
import { appReadJsonBody, appSendJson } from "../appHttp.js";

export type RouteAuthRefreshOptions = {
    secretResolve: () => Promise<string>;
};

/**
 * Handles POST /auth/refresh — validates a token and returns a fresh session token.
 * Expects: options contains secretResolve for JWT verification/signing.
 */
export async function routeAuthRefresh(
    request: http.IncomingMessage,
    response: http.ServerResponse,
    options: RouteAuthRefreshOptions
): Promise<void> {
    const body = await appReadJsonBody(request);
    const token = typeof body.token === "string" ? body.token.trim() : "";
    if (!token) {
        appSendJson(response, 200, { ok: false, error: "Token is required." });
        return;
    }

    try {
        const secret = await options.secretResolve();
        let userId: string;

        try {
            const sessionPayload = await jwtVerify(token, secret);
            userId = sessionPayload.userId;
        } catch {
            const linkPayload = await jwtVerify(token, secret, { service: APP_AUTH_LINK_SERVICE });
            userId = linkPayload.userId;
        }

        const refreshedToken = await jwtSign({ userId }, secret, APP_AUTH_SESSION_EXPIRES_IN_SECONDS);
        appSendJson(response, 200, {
            ok: true,
            token: refreshedToken,
            userId,
            expiresAt: Date.now() + APP_AUTH_SESSION_EXPIRES_IN_SECONDS * 1000
        });
    } catch (error) {
        appSendJson(response, 200, {
            ok: false,
            error: error instanceof Error ? error.message : "Invalid token"
        });
    }
}
