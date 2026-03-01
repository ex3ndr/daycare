import type http from "node:http";
import type { Context } from "@/types";
import type { RouteAgentCallbacks } from "../routeTypes.js";
import { agentsHistory } from "./agentsHistory.js";
import { agentsList } from "./agentsList.js";
import { agentsMessage } from "./agentsMessage.js";

export type AgentsRouteContext = {
    ctx: Context;
    sendJson: (response: http.ServerResponse, statusCode: number, payload: Record<string, unknown>) => void;
    readJsonBody: (request: http.IncomingMessage) => Promise<Record<string, unknown>>;
    callbacks: RouteAgentCallbacks | null;
};

/**
 * Routes authenticated agent APIs (list/history/message).
 * Returns true when an /agents endpoint handled the request.
 */
export async function agentsRouteHandle(
    request: http.IncomingMessage,
    response: http.ServerResponse,
    pathname: string,
    context: AgentsRouteContext
): Promise<boolean> {
    if (!pathname.startsWith("/agents")) {
        return false;
    }

    if (!context.callbacks) {
        context.sendJson(response, 503, {
            ok: false,
            error: "Agent runtime unavailable."
        });
        return true;
    }

    if (pathname === "/agents" && request.method === "GET") {
        const result = await agentsList({
            ctx: context.ctx,
            agentList: context.callbacks.agentList
        });
        context.sendJson(response, 200, result);
        return true;
    }

    const historyMatch = pathname.match(/^\/agents\/([^/]+)\/history$/);
    if (historyMatch?.[1] && request.method === "GET") {
        const url = new URL(request.url ?? pathname, "http://localhost");
        const limit = limitParse(url.searchParams.get("limit"));
        if (limit === null) {
            context.sendJson(response, 400, { ok: false, error: "limit must be a positive integer." });
            return true;
        }

        const result = await agentsHistory({
            ctx: context.ctx,
            agentId: decodeURIComponent(historyMatch[1]),
            limit: limit ?? undefined,
            agentHistoryLoad: context.callbacks.agentHistoryLoad
        });
        context.sendJson(response, result.ok ? 200 : 400, result);
        return true;
    }

    const messageMatch = pathname.match(/^\/agents\/([^/]+)\/message$/);
    if (messageMatch?.[1] && request.method === "POST") {
        const body = await context.readJsonBody(request);
        const result = await agentsMessage({
            ctx: context.ctx,
            agentId: decodeURIComponent(messageMatch[1]),
            text: typeof body.text === "string" ? body.text : "",
            agentPost: context.callbacks.agentPost
        });
        context.sendJson(response, result.ok ? 200 : 400, result);
        return true;
    }

    return false;
}

function limitParse(raw: string | null): number | undefined | null {
    if (raw === null || raw === "") {
        return undefined;
    }
    const parsed = Number(raw);
    if (!Number.isInteger(parsed) || parsed <= 0) {
        return null;
    }
    return parsed;
}
