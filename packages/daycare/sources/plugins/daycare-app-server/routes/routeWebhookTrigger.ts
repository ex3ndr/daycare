import type http from "node:http";
import { appReadJsonBody, appSendJson } from "../appHttp.js";

export type RouteWebhookTriggerOptions = {
    trigger: (webhookId: string, data?: unknown) => Promise<void>;
};

/**
 * Handles POST /v1/webhooks/:id — executes a webhook trigger.
 * Expects: webhook id is non-empty and option trigger calls runtime webhook execution.
 */
export async function routeWebhookTrigger(
    request: http.IncomingMessage,
    response: http.ServerResponse,
    webhookId: string,
    options: RouteWebhookTriggerOptions
): Promise<void> {
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
        appSendJson(response, 500, { ok: false, error: message });
    }
}
