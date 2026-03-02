import type http from "node:http";
import type { AgentSkill, Context, TaskActiveSummary, TaskListAllResult } from "@/types";
import type { EngineEventBus } from "../../engine/ipc/events.js";
import type { TokenStatsHourlyDbRecord } from "../../storage/databaseTypes.js";
import type { DocumentsRepository } from "../../storage/documentsRepository.js";
import type { UsersRepository } from "../../storage/usersRepository.js";
import { agentsRouteHandle } from "./agents/agentsRoutes.js";
import type { TokenStatsFetchOptions } from "./costs/costsRoutes.js";
import { costsRouteHandle } from "./costs/costsRoutes.js";
import { documentsRouteHandle } from "./documents/documentsRoutes.js";
import { profileRouteHandle } from "./profile/profileRoutes.js";
import { promptsRouteHandle } from "./prompts/promptsRoutes.js";
import type { RouteAgentCallbacks, RouteTaskCallbacks } from "./routeTypes.js";
import { skillsRouteHandle } from "./skills/skillsRoutes.js";
import { tasksRouteHandle } from "./tasks/tasksRoutes.js";

export type ApiRouteContext = {
    ctx: Context;
    usersDir: string;
    sendJson: (response: http.ServerResponse, statusCode: number, payload: Record<string, unknown>) => void;
    readJsonBody: (request: http.IncomingMessage) => Promise<Record<string, unknown>>;
    users: UsersRepository | null;
    agentCallbacks: RouteAgentCallbacks | null;
    eventBus: EngineEventBus | null;
    skills: { list: () => Promise<AgentSkill[]> } | null;
    tasksListActive: ((ctx: Context) => Promise<TaskActiveSummary[]>) | null;
    tasksListAll: ((ctx: Context) => Promise<TaskListAllResult>) | null;
    taskCallbacks: RouteTaskCallbacks | null;
    tokenStatsFetch: ((ctx: Context, options: TokenStatsFetchOptions) => Promise<TokenStatsHourlyDbRecord[]>) | null;
    documents: DocumentsRepository | null;
};

/**
 * Central API route dispatcher. Routes authenticated requests to domain handlers.
 * Returns true if the request was handled, false otherwise.
 *
 * Expects: ctx carries authenticated userId; caller handles auth before calling this.
 */
export async function apiRouteHandle(
    request: http.IncomingMessage,
    response: http.ServerResponse,
    pathname: string,
    context: ApiRouteContext
): Promise<boolean> {
    if (pathname.startsWith("/profile")) {
        return profileRouteHandle(request, response, pathname, {
            ctx: context.ctx,
            users: context.users,
            sendJson: context.sendJson,
            readJsonBody: context.readJsonBody
        });
    }
    if (pathname.startsWith("/agents")) {
        return agentsRouteHandle(request, response, pathname, {
            ctx: context.ctx,
            sendJson: context.sendJson,
            readJsonBody: context.readJsonBody,
            callbacks: context.agentCallbacks
        });
    }
    if (pathname.startsWith("/prompts")) {
        return promptsRouteHandle(request, response, pathname, context);
    }
    if (pathname.startsWith("/tasks")) {
        return tasksRouteHandle(request, response, pathname, {
            ctx: context.ctx,
            sendJson: context.sendJson,
            readJsonBody: context.readJsonBody,
            tasksListActive: context.tasksListActive,
            tasksListAll: context.tasksListAll,
            callbacks: context.taskCallbacks
        });
    }
    if (pathname.startsWith("/skills")) {
        return skillsRouteHandle(request, response, pathname, {
            sendJson: context.sendJson,
            skills: context.skills
        });
    }
    if (pathname.startsWith("/costs")) {
        return costsRouteHandle(request, response, pathname, {
            ctx: context.ctx,
            sendJson: context.sendJson,
            tokenStatsFetch: context.tokenStatsFetch
        });
    }
    if (pathname.startsWith("/documents") && context.documents) {
        return documentsRouteHandle(request, response, pathname, {
            ctx: context.ctx,
            sendJson: context.sendJson,
            readJsonBody: context.readJsonBody,
            documents: context.documents
        });
    }

    return false;
}
