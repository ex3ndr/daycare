import type http from "node:http";
import type { AppEmailAuth } from "../appEmailAuth.js";
import { appReadJsonBody, appSendJson } from "../appHttp.js";

export type RouteAuthEmailRequestOptions = {
    emailAuth: AppEmailAuth;
};

/**
 * Handles POST /auth/email/request and triggers Better Auth magic-link delivery.
 * Expects: options.emailAuth is configured with SMTP delivery.
 */
export async function routeAuthEmailRequest(
    request: http.IncomingMessage,
    response: http.ServerResponse,
    options: RouteAuthEmailRequestOptions
): Promise<void> {
    const body = await appReadJsonBody(request);
    const email = typeof body.email === "string" ? body.email.trim() : "";
    if (!email) {
        appSendJson(response, 200, { ok: false, error: "Email is required." });
        return;
    }

    try {
        await options.emailAuth.request(email, request.headers);
        appSendJson(response, 200, { ok: true });
    } catch (error) {
        appSendJson(response, 200, {
            ok: false,
            error: error instanceof Error ? error.message : "Failed to send sign-in email."
        });
    }
}
