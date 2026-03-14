import type http from "node:http";
import type { AppEmailAuth } from "../appEmailAuth.js";
import { appReadJsonBody, appSendJson } from "../appHttp.js";

export type RouteAuthEmailRequestOptions = {
    emailAuth: AppEmailAuth;
};

/**
 * Handles POST /auth/email/request and delivers a six-digit sign-in code.
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
        const result = await options.emailAuth.request(email);
        appSendJson(response, 200, {
            ok: true,
            expiresAt: result.expiresAt,
            retryAfterMs: result.retryAfterMs
        });
    } catch (error) {
        appSendJson(response, 200, {
            ok: false,
            error: error instanceof Error ? error.message : "Failed to send sign-in code."
        });
    }
}
