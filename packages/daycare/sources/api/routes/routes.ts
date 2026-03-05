import type http from "node:http";
import type { Tool } from "@mariozechner/pi-ai";
import type { AgentSkill, Context, TaskActiveSummary, TaskListAllResult } from "@/types";
import type { EngineEventBus } from "../../engine/ipc/events.js";
import type { Secret } from "../../engine/secrets/secretTypes.js";
import { UserHome } from "../../engine/users/userHome.js";
import type { PsqlService } from "../../services/psql/PsqlService.js";
import type { TokenStatsHourlyDbRecord } from "../../storage/databaseTypes.js";
import type { DocumentsRepository } from "../../storage/documentsRepository.js";
import type { FragmentsRepository } from "../../storage/fragmentsRepository.js";
import type { KeyValuesRepository } from "../../storage/keyValuesRepository.js";
import type { UsersRepository } from "../../storage/usersRepository.js";
import { agentsRouteHandle } from "./agents/agentsRoutes.js";
import type { TokenStatsFetchOptions } from "./costs/costsRoutes.js";
import { costsRouteHandle } from "./costs/costsRoutes.js";
import { databasesRouteHandle } from "./databases/databasesRoutes.js";
import { documentsRouteHandle } from "./documents/documentsRoutes.js";
import { fragmentsRouteHandle } from "./fragments/fragmentsRoutes.js";
import { kvRouteHandle } from "./kv/kvRoutes.js";
import { profileRouteHandle } from "./profile/profileRoutes.js";
import { promptsRouteHandle } from "./prompts/promptsRoutes.js";
import type { RouteAgentCallbacks, RouteTaskCallbacks } from "./routeTypes.js";
import { secretsRouteHandle } from "./secrets/secretsRoutes.js";
import { skillsRouteHandle } from "./skills/skillsRoutes.js";
import { swarmsRouteHandle } from "./swarms/swarmsRoutes.js";
import { tasksRouteHandle } from "./tasks/tasksRoutes.js";
import { toolsRouteHandle } from "./tools/toolsRoutes.js";

export type ApiRouteContext = {
    ctx: Context;
    usersDir: string;
    sendJson: (response: http.ServerResponse, statusCode: number, payload: Record<string, unknown>) => void;
    readJsonBody: (request: http.IncomingMessage) => Promise<Record<string, unknown>>;
    users: UsersRepository | null;
    agentCallbacks: RouteAgentCallbacks | null;
    eventBus: EngineEventBus | null;
    skills: { list: () => Promise<AgentSkill[]> } | null;
    tools: { list: () => Tool[] } | null;
    tasksListActive: ((ctx: Context) => Promise<TaskActiveSummary[]>) | null;
    tasksListAll: ((ctx: Context) => Promise<TaskListAllResult>) | null;
    taskCallbacks: RouteTaskCallbacks | null;
    tokenStatsFetch: ((ctx: Context, options: TokenStatsFetchOptions) => Promise<TokenStatsHourlyDbRecord[]>) | null;
    documents: DocumentsRepository | null;
    fragments: FragmentsRepository | null;
    keyValues: KeyValuesRepository | null;
    psql: PsqlService | null;
    secrets: {
        list: (ctx: Context) => Promise<Secret[]>;
        add: (ctx: Context, secret: Secret) => Promise<void>;
        remove: (ctx: Context, name: string) => Promise<boolean>;
    } | null;
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
        const userHome = new UserHome(context.usersDir, context.ctx.userId);
        return skillsRouteHandle(request, response, pathname, {
            sendJson: context.sendJson,
            readJsonBody: context.readJsonBody,
            personalRoot: userHome.skillsPersonal,
            skills: context.skills
        });
    }
    if (pathname.startsWith("/tools")) {
        return toolsRouteHandle(request, response, pathname, {
            sendJson: context.sendJson,
            tools: context.tools
        });
    }
    if (pathname.startsWith("/secrets")) {
        return secretsRouteHandle(request, response, pathname, {
            ctx: context.ctx,
            sendJson: context.sendJson,
            readJsonBody: context.readJsonBody,
            secrets: context.secrets
        });
    }
    if (pathname.startsWith("/swarms")) {
        return swarmsRouteHandle(request, response, pathname, {
            ctx: context.ctx,
            sendJson: context.sendJson,
            readJsonBody: context.readJsonBody,
            users: context.users,
            secrets: context.secrets
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
    if (pathname.startsWith("/fragments")) {
        return fragmentsRouteHandle(request, response, pathname, {
            ctx: context.ctx,
            sendJson: context.sendJson,
            readJsonBody: context.readJsonBody,
            fragments: context.fragments
        });
    }
    if (pathname.startsWith("/kv")) {
        return kvRouteHandle(request, response, pathname, {
            ctx: context.ctx,
            sendJson: context.sendJson,
            readJsonBody: context.readJsonBody,
            keyValues: context.keyValues
        });
    }
    if (pathname.startsWith("/databases")) {
        return databasesRouteHandle(request, response, pathname, {
            ctx: context.ctx,
            sendJson: context.sendJson,
            readJsonBody: context.readJsonBody,
            psql: context.psql
        });
    }

    return false;
}
