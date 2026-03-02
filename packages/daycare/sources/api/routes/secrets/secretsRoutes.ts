import type http from "node:http";
import type { Context } from "@/types";
import { secretsCreate } from "./secretsCreate.js";
import { secretsDelete } from "./secretsDelete.js";
import { secretsList } from "./secretsList.js";
import { secretsRead } from "./secretsRead.js";
import type { SecretsRuntime } from "./secretsTypes.js";
import { secretsUpdate } from "./secretsUpdate.js";

export type SecretsRouteContext = {
    ctx: Context;
    sendJson: (response: http.ServerResponse, statusCode: number, payload: Record<string, unknown>) => void;
    readJsonBody: (request: http.IncomingMessage) => Promise<Record<string, unknown>>;
    secrets: SecretsRuntime | null;
};

/**
 * Routes authenticated secret APIs.
 * Returns true when a /secrets endpoint is matched and handled.
 */
export async function secretsRouteHandle(
    request: http.IncomingMessage,
    response: http.ServerResponse,
    pathname: string,
    context: SecretsRouteContext
): Promise<boolean> {
    if (!pathname.startsWith("/secrets")) {
        return false;
    }

    if (!context.secrets) {
        context.sendJson(response, 503, {
            ok: false,
            error: "Secrets runtime unavailable."
        });
        return true;
    }

    if (pathname === "/secrets" && request.method === "GET") {
        const result = await secretsList({
            ctx: context.ctx,
            secrets: context.secrets
        });
        context.sendJson(response, 200, result);
        return true;
    }

    if (pathname === "/secrets/create" && request.method === "POST") {
        const body = await context.readJsonBody(request);
        const result = await secretsCreate({
            ctx: context.ctx,
            body,
            secrets: context.secrets
        });
        context.sendJson(response, result.ok ? 200 : 400, result);
        return true;
    }

    const readMatch = pathname.match(/^\/secrets\/([^/]+)$/);
    if (readMatch?.[1] && request.method === "GET") {
        const result = await secretsRead({
            ctx: context.ctx,
            name: decodeURIComponent(readMatch[1]),
            secrets: context.secrets
        });
        context.sendJson(response, result.ok ? 200 : result.error === "Secret not found." ? 404 : 400, result);
        return true;
    }

    const updateMatch = pathname.match(/^\/secrets\/([^/]+)\/update$/);
    if (updateMatch?.[1] && request.method === "POST") {
        const body = await context.readJsonBody(request);
        const result = await secretsUpdate({
            ctx: context.ctx,
            name: decodeURIComponent(updateMatch[1]),
            body,
            secrets: context.secrets
        });
        context.sendJson(response, result.ok ? 200 : result.error === "Secret not found." ? 404 : 400, result);
        return true;
    }

    const deleteMatch = pathname.match(/^\/secrets\/([^/]+)\/delete$/);
    if (deleteMatch?.[1] && request.method === "POST") {
        const result = await secretsDelete({
            ctx: context.ctx,
            name: decodeURIComponent(deleteMatch[1]),
            secrets: context.secrets
        });
        context.sendJson(response, result.ok ? 200 : result.error === "Secret not found." ? 404 : 400, result);
        return true;
    }

    return false;
}
