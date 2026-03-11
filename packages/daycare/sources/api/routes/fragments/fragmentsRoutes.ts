import type http from "node:http";
import type { Context } from "@/types";
import type { FragmentsRepository } from "../../../storage/fragmentsRepository.js";
import { fragmentsArchive } from "./fragmentsArchive.js";
import { fragmentsRestore } from "./fragmentsRestore.js";
import { fragmentsCreate } from "./fragmentsCreate.js";
import { fragmentsFindById } from "./fragmentsFindById.js";
import { fragmentsList } from "./fragmentsList.js";
import { fragmentsUpdate } from "./fragmentsUpdate.js";

export type FragmentsRouteContext = {
    ctx: Context;
    sendJson: (response: http.ServerResponse, statusCode: number, payload: Record<string, unknown>) => void;
    readJsonBody: (request: http.IncomingMessage) => Promise<Record<string, unknown>>;
    fragments: FragmentsRepository | null;
};

/**
 * Routes authenticated fragments APIs.
 * Returns true when a /fragments endpoint is matched and handled.
 */
export async function fragmentsRouteHandle(
    request: http.IncomingMessage,
    response: http.ServerResponse,
    pathname: string,
    context: FragmentsRouteContext
): Promise<boolean> {
    if (!pathname.startsWith("/fragments")) {
        return false;
    }

    if (!context.fragments) {
        context.sendJson(response, 503, { ok: false, error: "Fragments repository unavailable." });
        return true;
    }

    if (pathname === "/fragments" && request.method === "GET") {
        const result = await fragmentsList({
            ctx: context.ctx,
            fragments: context.fragments
        });
        context.sendJson(response, 200, result);
        return true;
    }

    if (pathname === "/fragments/create" && request.method === "POST") {
        const body = await context.readJsonBody(request);
        const result = await fragmentsCreate({
            ctx: context.ctx,
            body,
            fragments: context.fragments
        });
        context.sendJson(response, result.ok ? 200 : 400, result);
        return true;
    }

    const findMatch = pathname.match(/^\/fragments\/([^/]+)$/);
    if (findMatch?.[1] && request.method === "GET") {
        const result = await fragmentsFindById({
            ctx: context.ctx,
            id: decodeURIComponent(findMatch[1]),
            fragments: context.fragments
        });
        context.sendJson(response, result.ok ? 200 : result.error === "Fragment not found." ? 404 : 400, result);
        return true;
    }

    const updateMatch = pathname.match(/^\/fragments\/([^/]+)\/update$/);
    if (updateMatch?.[1] && request.method === "POST") {
        const body = await context.readJsonBody(request);
        const result = await fragmentsUpdate({
            ctx: context.ctx,
            id: decodeURIComponent(updateMatch[1]),
            body,
            fragments: context.fragments
        });
        context.sendJson(response, result.ok ? 200 : result.error.includes("not found") ? 404 : 400, result);
        return true;
    }

    const archiveMatch = pathname.match(/^\/fragments\/([^/]+)\/archive$/);
    if (archiveMatch?.[1] && request.method === "POST") {
        const result = await fragmentsArchive({
            ctx: context.ctx,
            id: decodeURIComponent(archiveMatch[1]),
            fragments: context.fragments
        });
        context.sendJson(response, result.ok ? 200 : result.error.includes("not found") ? 404 : 400, result);
        return true;
    }

    const restoreMatch = pathname.match(/^\/fragments\/([^/]+)\/restore$/);
    if (restoreMatch?.[1] && request.method === "POST") {
        const result = await fragmentsRestore({
            ctx: context.ctx,
            id: decodeURIComponent(restoreMatch[1]),
            fragments: context.fragments
        });
        context.sendJson(response, result.ok ? 200 : result.error.includes("not found") ? 404 : 400, result);
        return true;
    }

    return false;
}