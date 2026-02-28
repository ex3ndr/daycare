import type http from "node:http";
import { jwtVerify } from "../../../util/jwt.js";
import { appReadJsonBody, appSendJson } from "../appHttp.js";

export type RouteWebhookTriggerOptions = {
    secretResolve: () => Promise<string>;
    trigger: (webhookId: string, data?: unknown) => Promise<void>;
};

/**
 * Handles POST /v1/webhooks/:token — executes a webhook trigger.
 * Expects: webhook token is signed and includes webhook id as the user claim.
 */
export async function routeWebhookTrigger(
    request: http.IncomingMessage,
    response: http.ServerResponse,
    webhookToken: string,
    options: RouteWebhookTriggerOptions
): Promise<void> {
    let webhookId = "";
    try {
        const verified = await jwtVerify(webhookToken, await options.secretResolve());
        webhookId = verified.userId.trim();
        if (!webhookId) {
            appSendJson(response, 404, { ok: false, error: "Webhook trigger not found." });
            return;
        }
    } catch {
        appSendJson(response, 404, { ok: false, error: "Webhook trigger not found." });
        return;
    }

    const body = await appReadJsonBody(request);
    const data = Object.keys(body).length > 0 ? body : undefined;

    try {
        await options.trigger(webhookId, data);
        appSendJson(response, 200, { ok: true });
    } catch (error) {
        const message = error instanceof Error ? error.message : "Webhook trigger failed";
        if (message.startsWith("Webhook trigger not found:")) {
            appSendJson(response, 404, { ok: false, error: message });
            return;
        }
        if (message === "Webhook runtime unavailable.") {
            appSendJson(response, 503, { ok: false, error: message });
            return;
        }
        appSendJson(response, 500, { ok: false, error: message });
    }
}
