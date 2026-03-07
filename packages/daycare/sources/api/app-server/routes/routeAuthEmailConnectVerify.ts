import type http from "node:http";
import type { AppEmailConnect } from "../appEmailConnect.js";
import { appReadJsonBody, appSendJson } from "../appHttp.js";

export type RouteAuthEmailConnectVerifyOptions = {
    emailConnect: AppEmailConnect;
};

/**
 * Handles POST /auth/email/connect/verify and links a verified email to an existing Daycare user.
 * Expects: options.emailConnect is configured with the active JWT secret and email settings.
 */
export async function routeAuthEmailConnectVerify(
    request: http.IncomingMessage,
    response: http.ServerResponse,
    options: RouteAuthEmailConnectVerifyOptions
): Promise<void> {
    const body = await appReadJsonBody(request);
    const token = typeof body.token === "string" ? body.token.trim() : "";
    if (!token) {
        appSendJson(response, 200, { ok: false, error: "Token is required." });
        return;
    }

    try {
        const verified = await options.emailConnect.verify(token);
        appSendJson(response, 200, {
            ok: true,
            userId: verified.userId,
            email: verified.email
        });
    } catch (error) {
        appSendJson(response, 200, {
            ok: false,
            error: error instanceof Error ? error.message : "Email connection failed."
        });
    }
}
