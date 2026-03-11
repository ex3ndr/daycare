import type http from "node:http";
import type { Tool } from "@mariozechner/pi-ai";
import type { AgentSkill, Context, TaskActiveSummary, TaskListAllResult } from "@/types";
import type { EngineEventBus } from "../../engine/ipc/events.js";
import type { MiniApps } from "../../engine/mini-apps/MiniApps.js";
import type { Secret } from "../../engine/secrets/secretTypes.js";
import { UserHome } from "../../engine/users/userHome.js";
import type { PsqlService } from "../../services/psql/PsqlService.js";
import type { TokenStatsHourlyDbRecord } from "../../storage/databaseTypes.js";
import type { DocumentsRepository } from "../../storage/documentsRepository.js";
import type { FragmentsRepository } from "../../storage/fragmentsRepository.js";
import type { KeyValuesRepository } from "../../storage/keyValuesRepository.js";
import type { ObservationLogRepository } from "../../storage/observationLogRepository.js";
import type { TodosRepository } from "../../storage/todosRepository.js";
import type { UsersRepository } from "../../storage/usersRepository.js";
import type { WorkspaceMembersRepository } from "../../storage/workspaceMembersRepository.js";
import { agentsRouteHandle } from "./agents/agentsRoutes.js";
import { configRouteHandle } from "./config/configRoutes.js";
import type { TokenStatsFetchOptions } from "./costs/costsRoutes.js";
import { costsRouteHandle } from "./costs/costsRoutes.js";
import { databasesRouteHandle } from "./databases/databasesRoutes.js";
import { documentsRouteHandle } from "./documents/documentsRoutes.js";
import { filesRouteHandle } from "./files/filesRoutes.js";
import { fragmentsRouteHandle } from "./fragments/fragmentsRoutes.js";
import { inviteRouteHandle } from "./invite/inviteRoutes.js";
import { kvRouteHandle } from "./kv/kvRoutes.js";
import { miniAppsRouteHandle } from "./mini-apps/miniAppsRoutes.js";
import { observationsRouteHandle } from "./observations/observationsRoutes.js";
import { profileRouteHandle } from "./profile/profileRoutes.js";
import type { RouteAgentCallbacks, RouteTaskCallbacks } from "./routeTypes.js";
import { secretsRouteHandle } from "./secrets/secretsRoutes.js";
import { skillsRouteHandle } from "./skills/skillsRoutes.js";
import { tasksRouteHandle } from "./tasks/tasksRoutes.js";
import { todosRouteHandle } from "./todos/todosRoutes.js";
import { toolsRouteHandle } from "./tools/toolsRoutes.js";
import { workspacesRouteHandle } from "./workspaces/workspacesRoutes.js";

export type ApiRouteContext = {
    ctx: Context;
    usersDir: string;
    sendJson: (response: http.ServerResponse, statusCode: number, payload: Record<string, unknown>) => void;
    readJsonBody: (request: http.IncomingMessage) => Promise<Record<string, unknown>>;
    users: UsersRepository | null;
    workspaceMembers: WorkspaceMembersRepository | null;
    agentCallbacks: RouteAgentCallbacks | null;
    eventBus: EngineEventBus | null;
    skills: { list: () => Promise<AgentSkill[]> } | null;
    tools: { list: () => Tool[] } | null;
    tasksListActive: ((ctx: Context) => Promise<TaskActiveSummary[]>) | null;
    tasksListAll: ((ctx: Context) => Promise<TaskListAllResult>) | null;
    taskCallbacks: RouteTaskCallbacks | null;
    todos?: TodosRepository | null;
    tokenStatsFetch: ((ctx: Context, options: TokenStatsFetchOptions) => Promise<TokenStatsHourlyDbRecord[]>) | null;
    documents: DocumentsRepository | null;
    fragments: FragmentsRepository | null;
    keyValues: KeyValuesRepository | null;
    miniApps: MiniApps | null;
    psql: PsqlService | null;
    observationLog: ObservationLogRepository | null;
    publicEndpoints?: {
        appEndpoint: string;
        serverEndpoint: string;
    } | null;
    secretResolve?: (() => Promise<string>) | null;
    secrets: {
        list: (ctx: Context) => Promise<Secret[]>;
        add: (ctx: Context, secret: Secret) => Promise<void>;
        remove: (ctx: Context, name: string) => Promise<boolean>;
    } | null;
    emailConnectRequest: ((userId: string, email: string) => Promise<void>) | null;
    miniAppLaunch: ((ctx: Context, id: string) => Promise<{ launchPath: string; expiresAt: number }>) | null;
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
    if (pathname === "/config") {
        return configRouteHandle(request, response, pathname, {
            ctx: context.ctx,
            users: context.users,
            sendJson: context.sendJson
        });
    }
    if (pathname.startsWith("/profile")) {
        return profileRouteHandle(request, response, pathname, {
            ctx: context.ctx,
            users: context.users,
            eventBus: context.eventBus,
            emailConnectRequest: context.emailConnectRequest,
            sendJson: context.sendJson,
            readJsonBody: context.readJsonBody
        });
    }
    if (pathname.startsWith("/agents")) {
        return agentsRouteHandle(request, response, pathname, {
            ctx: context.ctx,
            sendJson: context.sendJson,
            readJsonBody: context.readJsonBody,
            callbacks: context.agentCallbacks,
            users: context.users,
            eventBus: context.eventBus
        });
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
    if (pathname.startsWith("/todos")) {
        return todosRouteHandle(request, response, pathname, {
            ctx: context.ctx,
            sendJson: context.sendJson,
            readJsonBody: context.readJsonBody,
            todos: context.todos ?? null
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
    if (pathname.startsWith("/workspaces")) {
        return workspacesRouteHandle(request, response, pathname, {
            ctx: context.ctx,
            sendJson: context.sendJson,
            readJsonBody: context.readJsonBody,
            users: context.users,
            workspaceMembers: context.workspaceMembers,
            secrets: context.secrets,
            publicEndpoints: context.publicEndpoints ?? null,
            secretResolve: context.secretResolve ?? null
        });
    }
    if (pathname.startsWith("/invite")) {
        return inviteRouteHandle(request, response, pathname, {
            ctx: context.ctx,
            sendJson: context.sendJson,
            readJsonBody: context.readJsonBody,
            users: context.users,
            workspaceMembers: context.workspaceMembers,
            secretResolve: context.secretResolve ?? null
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
    if (pathname.startsWith("/mini-apps")) {
        return miniAppsRouteHandle(request, response, pathname, {
            ctx: context.ctx,
            sendJson: context.sendJson,
            readJsonBody: context.readJsonBody,
            miniApps: context.miniApps,
            launch: context.miniAppLaunch
        });
    }
    if (pathname.startsWith("/files")) {
        const userHome = new UserHome(context.usersDir, context.ctx.userId);
        return filesRouteHandle(request, response, pathname, {
            homeDir: userHome.home,
            sendJson: context.sendJson
        });
    }
    if (pathname.startsWith("/observations")) {
        return observationsRouteHandle(request, response, pathname, {
            ctx: context.ctx,
            sendJson: context.sendJson,
            observationLog: context.observationLog
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
