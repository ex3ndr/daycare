import type http from "node:http";
import type { Context } from "@/types";
import type { KeyValuesRepository } from "../../../storage/keyValuesRepository.js";
import { kvCreate } from "./kvCreate.js";
import { kvDelete } from "./kvDelete.js";
import { kvList } from "./kvList.js";
import { kvRead } from "./kvRead.js";
import { kvUpdate } from "./kvUpdate.js";

export type KvRouteContext = {
    ctx: Context;
    sendJson: (response: http.ServerResponse, statusCode: number, payload: Record<string, unknown>) => void;
    readJsonBody: (request: http.IncomingMessage) => Promise<Record<string, unknown>>;
    keyValues: KeyValuesRepository | null;
};

/**
 * Routes authenticated key-value APIs.
 * Returns true when a /kv endpoint is matched and handled.
 */
export async function kvRouteHandle(
    request: http.IncomingMessage,
    response: http.ServerResponse,
    pathname: string,
    context: KvRouteContext
): Promise<boolean> {
    if (!pathname.startsWith("/kv")) {
        return false;
    }

    if (!context.keyValues) {
        context.sendJson(response, 503, {
            ok: false,
            error: "Key-values repository unavailable."
        });
        return true;
    }

    if (pathname === "/kv" && request.method === "GET") {
        const result = await kvList({
            ctx: context.ctx,
            keyValues: context.keyValues
        });
        context.sendJson(response, 200, result);
        return true;
    }

    if (pathname === "/kv/create" && request.method === "POST") {
        const body = await context.readJsonBody(request);
        const result = await kvCreate({
            ctx: context.ctx,
            body,
            keyValues: context.keyValues
        });
        context.sendJson(response, result.ok ? 200 : 400, result);
        return true;
    }

    const readMatch = pathname.match(/^\/kv\/([^/]+)$/);
    if (readMatch?.[1] && request.method === "GET") {
        const result = await kvRead({
            ctx: context.ctx,
            key: decodeURIComponent(readMatch[1]),
            keyValues: context.keyValues
        });
        context.sendJson(response, result.ok ? 200 : result.error === "Entry not found." ? 404 : 400, result);
        return true;
    }

    const updateMatch = pathname.match(/^\/kv\/([^/]+)\/update$/);
    if (updateMatch?.[1] && request.method === "POST") {
        const body = await context.readJsonBody(request);
        const result = await kvUpdate({
            ctx: context.ctx,
            key: decodeURIComponent(updateMatch[1]),
            body,
            keyValues: context.keyValues
        });
        context.sendJson(response, result.ok ? 200 : result.error === "Entry not found." ? 404 : 400, result);
        return true;
    }

    const deleteMatch = pathname.match(/^\/kv\/([^/]+)\/delete$/);
    if (deleteMatch?.[1] && request.method === "POST") {
        const result = await kvDelete({
            ctx: context.ctx,
            key: decodeURIComponent(deleteMatch[1]),
            keyValues: context.keyValues
        });
        context.sendJson(response, result.ok ? 200 : result.error === "Entry not found." ? 404 : 400, result);
        return true;
    }

    return false;
}
