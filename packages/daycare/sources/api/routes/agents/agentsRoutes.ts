import type http from "node:http";
import type { Context } from "@/types";
import type { EngineEventBus } from "../../../engine/ipc/events.js";
import type { UsersRepository } from "../../../storage/usersRepository.js";
import type { RouteAgentCallbacks } from "../routeTypes.js";
import { agentsChats } from "./agentsChats.js";
import { agentsCreate } from "./agentsCreate.js";
import { agentsDelete } from "./agentsDelete.js";
import { agentsDirect } from "./agentsDirect.js";
import { agentsHistory } from "./agentsHistory.js";
import { agentsList } from "./agentsList.js";
import { agentsMessage } from "./agentsMessage.js";
import { agentsMessagesRead } from "./agentsMessagesRead.js";
import { agentsSupervisor } from "./agentsSupervisor.js";
import { agentsSupervisorBootstrap } from "./agentsSupervisorBootstrap.js";

export type AgentsRouteContext = {
    ctx: Context;
    sendJson: (response: http.ServerResponse, statusCode: number, payload: Record<string, unknown>) => void;
    readJsonBody: (request: http.IncomingMessage) => Promise<Record<string, unknown>>;
    callbacks: RouteAgentCallbacks | null;
    users: UsersRepository | null;
    eventBus: EngineEventBus | null;
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

    if (pathname === "/agents/chats" && request.method === "GET") {
        const result = await agentsChats({
            ctx: context.ctx,
            agentList: context.callbacks.agentList
        });
        context.sendJson(response, 200, result);
        return true;
    }

    if (pathname === "/agents/direct" && request.method === "GET") {
        const result = await agentsDirect({
            ctx: context.ctx,
            agentDirectResolve: context.callbacks.agentDirectResolve
        });
        context.sendJson(response, result.ok ? 200 : 400, result);
        return true;
    }

    if (pathname === "/agents/supervisor" && request.method === "GET") {
        const result = await agentsSupervisor({
            ctx: context.ctx,
            agentSupervisorResolve: context.callbacks.agentSupervisorResolve
        });
        context.sendJson(response, result.ok ? 200 : 400, result);
        return true;
    }

    if (pathname === "/agents/supervisor/bootstrap" && request.method === "POST") {
        if (!context.users) {
            context.sendJson(response, 503, { ok: false, error: "Users repository unavailable." });
            return true;
        }
        const body = await context.readJsonBody(request);
        const result = await agentsSupervisorBootstrap({
            ctx: context.ctx,
            body,
            agentSupervisorResolve: context.callbacks.agentSupervisorResolve,
            agentPost: context.callbacks.agentPost,
            users: context.users,
            eventBus: context.eventBus
        });
        context.sendJson(response, result.ok ? 200 : 400, result);
        return true;
    }

    if (pathname === "/agents/create" && request.method === "POST") {
        const body = await context.readJsonBody(request);
        const result = await agentsCreate({
            ctx: context.ctx,
            body,
            agentCreate: context.callbacks.agentCreate
        });
        context.sendJson(response, result.ok ? 200 : 400, result);
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

    const messagesReadMatch = pathname.match(/^\/agents\/([^/]+)\/messages$/);
    if (messagesReadMatch?.[1] && request.method === "GET") {
        const url = new URL(request.url ?? pathname, "http://localhost");
        const after = afterParse(url.searchParams.get("after"));
        if (after === null) {
            context.sendJson(response, 400, {
                ok: false,
                error: "after must be a non-negative unix timestamp in milliseconds."
            });
            return true;
        }
        const limit = limitParse(url.searchParams.get("limit"));
        if (limit === null) {
            context.sendJson(response, 400, { ok: false, error: "limit must be a positive integer." });
            return true;
        }
        const result = await agentsMessagesRead({
            ctx: context.ctx,
            agentId: decodeURIComponent(messagesReadMatch[1]),
            after: after ?? 0,
            limit: limit ?? undefined,
            agentHistoryLoadAfter: context.callbacks.agentHistoryLoadAfter
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

    const messageCreateMatch = pathname.match(/^\/agents\/([^/]+)\/messages\/create$/);
    if (messageCreateMatch?.[1] && request.method === "POST") {
        const body = await context.readJsonBody(request);
        const result = await agentsMessage({
            ctx: context.ctx,
            agentId: decodeURIComponent(messageCreateMatch[1]),
            text: typeof body.text === "string" ? body.text : "",
            agentPost: context.callbacks.agentPost
        });
        context.sendJson(response, result.ok ? 200 : 400, result);
        return true;
    }

    const deleteMatch = pathname.match(/^\/agents\/([^/]+)\/delete$/);
    if (deleteMatch?.[1] && request.method === "POST") {
        const result = await agentsDelete({
            ctx: context.ctx,
            agentId: decodeURIComponent(deleteMatch[1]),
            agentKill: context.callbacks.agentKill
        });
        context.sendJson(response, result.ok ? 200 : 404, result);
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

function afterParse(raw: string | null): number | undefined | null {
    if (raw === null || raw === "") {
        return undefined;
    }
    const parsed = Number(raw);
    if (!Number.isInteger(parsed) || parsed < 0) {
        return null;
    }
    return parsed;
}
