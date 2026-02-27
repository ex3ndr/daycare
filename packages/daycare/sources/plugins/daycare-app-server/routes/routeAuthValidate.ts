import type http from "node:http";
import { jwtVerify } from "../../../util/jwt.js";
import { appReadJsonBody, appSendJson } from "../appHttp.js";

/**
 * Handles POST /auth/validate — verifies a magic link token.
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
        const payload = await jwtVerify(token, await secretResolve());
        appSendJson(response, 200, { ok: true, userId: payload.userId });
    } catch (error) {
        appSendJson(response, 200, {
            ok: false,
            error: error instanceof Error ? error.message : "Invalid token"
        });
    }
}
