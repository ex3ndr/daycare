import type http from "node:http";
import { jwtSign, jwtVerify } from "../../../utils/jwt.js";
import { APP_AUTH_LINK_SERVICE, APP_AUTH_SESSION_EXPIRES_IN_SECONDS } from "../appAuthLinkTool.js";
import { appReadJsonBody, appSendJson } from "../appHttp.js";

/**
 * Handles POST /auth/validate — validates auth tokens and exchanges link tokens to session tokens.
 * Expects: secretResolve returns the active JWT signing secret.
 */
export async function routeAuthValidate(
    request: http.IncomingMessage,
    response: http.ServerResponse,
    secretResolve: () => Promise<string>
): Promise<void> {
    const body = await appReadJsonBody(request);
    const token = typeof body.token === "string" ? body.token.trim() : "";
    if (!token) {
        appSendJson(response, 200, { ok: false, error: "Token is required." });
        return;
    }

    try {
        const secret = await secretResolve();

        // Session token remains valid as-is and can be reused by clients.
        try {
            const sessionPayload = await jwtVerify(token, secret);
            appSendJson(response, 200, {
                ok: true,
                userId: sessionPayload.userId,
                token,
                expiresAt: sessionPayload.exp * 1000
            });
            return;
        } catch {
            // Fall through to link token exchange.
        }

        const linkPayload = await jwtVerify(token, secret, { service: APP_AUTH_LINK_SERVICE });
        const sessionToken = await jwtSign({ userId: linkPayload.userId }, secret, APP_AUTH_SESSION_EXPIRES_IN_SECONDS);
        appSendJson(response, 200, {
            ok: true,
            userId: linkPayload.userId,
            token: sessionToken,
            expiresAt: Date.now() + APP_AUTH_SESSION_EXPIRES_IN_SECONDS * 1000
        });
    } catch (error) {
        appSendJson(response, 200, {
            ok: false,
            error: error instanceof Error ? error.message : "Invalid token"
        });
    }
}
