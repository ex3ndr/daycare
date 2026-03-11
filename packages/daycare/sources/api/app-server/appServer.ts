import http from "node:http";
import type {
    AgentPath,
    AgentSkill,
    ConnectorMessage,
    ConnectorTarget,
    Context,
    TaskActiveSummary,
    TaskListAllResult,
    UserConfiguration
} from "@/types";
import type { AuthStore } from "../../auth/store.js";
import { emailSend } from "../../email/emailSend.js";
import { contextForUser } from "../../engine/agents/context.js";
import type { ConfigModule } from "../../engine/config/configModule.js";
import type { AgentSystem } from "../../engine/agents/agentSystem.js";
import type { EngineEvent, EngineEventBus } from "../../engine/ipc/events.js";
import type { MiniApps } from "../../engine/mini-apps/MiniApps.js";
import type { CommandRegistry } from "../../engine/modules/commandRegistry.js";
import type { ConnectorRegistry } from "../../engine/modules/connectorRegistry.js";
import type { ToolResolver } from "../../engine/modules/toolResolver.js";
import type { Secret } from "../../engine/secrets/secretTypes.js";
import { userConfigurationSyncEventBuild } from "../../engine/users/userConfigurationSyncEventBuild.js";
import type { Webhooks } from "../../engine/webhook/webhooks.js";
import { getLogger } from "../../log.js";
import type { DaycareDb } from "../../schema.js";
import type { PsqlService } from "../../services/psql/PsqlService.js";
import type { EmailSettings } from "../../settings.js";
import type { TokenStatsHourlyDbRecord } from "../../storage/databaseTypes.js";
import type { DocumentsRepository } from "../../storage/documentsRepository.js";
import type { FragmentsRepository } from "../../storage/fragmentsRepository.js";
import type { KeyValuesRepository } from "../../storage/keyValuesRepository.js";
import type { ObservationLogRepository } from "../../storage/observationLogRepository.js";
import type { TodosRepository } from "../../storage/todosRepository.js";
import { userConnectorKeyCreate } from "../../storage/userConnectorKeyCreate.js";
import type { UsersRepository } from "../../storage/usersRepository.js";
import type { WorkspaceMembersRepository } from "../../storage/workspaceMembersRepository.js";
import type { TokenStatsFetchOptions } from "../routes/costs/costsRoutes.js";
import { eventsRouteHandle } from "../routes/events/eventsRoutes.js";
import { apiRouteHandle } from "../routes/routes.js";
import type { RouteAgentCallbacks, RouteTaskCallbacks } from "../routes/routeTypes.js";
import { appAuthExtract } from "./appAuthExtract.js";
import { APP_AUTH_LINK_EXPIRES_IN_SECONDS, appAuthLinkGenerate, appAuthLinkTool } from "./appAuthLinkTool.js";
import { AppEmailAuth } from "./appEmailAuth.js";
import { AppEmailConnect } from "./appEmailConnect.js";
import { appCorsApply, appReadJsonBody, appSendJson, appSendText, appServerClose, appServerListen } from "./appHttp.js";
import { appJwtSecretResolve } from "./appJwtSecretResolve.js";
import { appRequestEndpointsResolve } from "./appRequestEndpointsResolve.js";
import type { AppServerResolvedSettings } from "./appServerSettingsResolve.js";
import { appServerSettingsResolve } from "./appServerSettingsResolve.js";
import { appWorkspaceResolve, WorkspaceAccessError } from "./appWorkspaceResolve.js";
import { miniAppServe } from "./miniAppServe.js";
import { miniAppTokenSign } from "./miniAppToken.js";
import { miniAppExec } from "../../engine/mini-apps/miniAppExec.js";
import { routeAuthEmailConnectVerify } from "./routes/routeAuthEmailConnectVerify.js";
import { routeAuthEmailRequest } from "./routes/routeAuthEmailRequest.js";
import { routeAuthEmailVerify } from "./routes/routeAuthEmailVerify.js";
import { routeAuthRefresh } from "./routes/routeAuthRefresh.js";
import { routeAuthTelegram } from "./routes/routeAuthTelegram.js";
import { routeAuthValidate } from "./routes/routeAuthValidate.js";
import { routeWebhookTrigger } from "./routes/routeWebhookTrigger.js";

const APP_SERVER_OWNER = "core.app-server";
const MINI_APP_TOKEN_TTL_SECONDS = 60 * 30;

export type AppServerOptions = {
    config: ConfigModule;
    db: DaycareDb;
    auth: AuthStore;
    commandRegistry: CommandRegistry;
    connectorRegistry: ConnectorRegistry;
    toolResolver: ToolResolver;
    webhooks: Webhooks;
    users: UsersRepository | null;
    workspaceMembers: WorkspaceMembersRepository | null;
    agentCallbacks: RouteAgentCallbacks | null;
    eventBus: EngineEventBus | null;
    skills: ((ctx: Context) => Promise<AgentSkill[]>) | null;
    tasksListActive: (ctx: Context) => Promise<TaskActiveSummary[]>;
    tasksListAll: (ctx: Context) => Promise<TaskListAllResult>;
    taskCallbacks: RouteTaskCallbacks | null;
    todos?: TodosRepository | null;
    tokenStatsFetch: (ctx: Context, options: TokenStatsFetchOptions) => Promise<TokenStatsHourlyDbRecord[]>;
    documents: DocumentsRepository | null;
    fragments: FragmentsRepository | null;
    keyValues: KeyValuesRepository | null;
    psql?: PsqlService | null;
    observationLog: ObservationLogRepository | null;
    miniApps?: MiniApps | null;
    secrets: {
        list: (ctx: Context) => Promise<Secret[]>;
        add: (ctx: Context, secret: Secret) => Promise<void>;
        remove: (ctx: Context, name: string) => Promise<boolean>;
    } | null;
    agentSystem?: AgentSystem | null;
    connectorTargetResolve: (path: AgentPath) => Promise<{ connector: string; targetId: string } | null>;
};

/**
 * Runs the Daycare app HTTP server from core runtime settings.
 * Manages route handling, command/tool registration, and lifecycle across reloads.
 *
 * Expects: dependencies are initialized and share the same engine config snapshot.
 */
export class AppServer {
    private readonly config: ConfigModule;
    private readonly db: DaycareDb;
    private readonly auth: AuthStore;
    private readonly commandRegistry: CommandRegistry;
    private readonly connectorRegistry: ConnectorRegistry;
    private readonly toolResolver: ToolResolver;
    private readonly webhooks: Webhooks;
    private readonly users: UsersRepository | null;
    private readonly workspaceMembers: WorkspaceMembersRepository | null;
    private readonly agentCallbacks: RouteAgentCallbacks | null;
    private readonly eventBus: EngineEventBus | null;
    private readonly skills: ((ctx: Context) => Promise<AgentSkill[]>) | null;
    private readonly tasksListActive: AppServerOptions["tasksListActive"];
    private readonly tasksListAll: AppServerOptions["tasksListAll"];
    private readonly taskCallbacks: RouteTaskCallbacks | null;
    private readonly todos: TodosRepository | null;
    private readonly tokenStatsFetch: AppServerOptions["tokenStatsFetch"];
    private readonly documents: DocumentsRepository | null;
    private readonly fragments: FragmentsRepository | null;
    private readonly keyValues: KeyValuesRepository | null;
    private readonly psql: PsqlService | null;
    private readonly observationLog: ObservationLogRepository | null;
    private readonly miniApps: MiniApps | null;
    private readonly secrets: AppServerOptions["secrets"];
    private readonly agentSystem: AgentSystem | null;
    private readonly connectorTargetResolve: AppServerOptions["connectorTargetResolve"];
    private readonly logger = getLogger("api.app-server");

    private server: http.Server | null = null;
    private activeSettings: AppServerResolvedSettings | null = null;
    private activeEmailSettings: EmailSettings | null = null;
    private secretPromise: Promise<string> | null = null;
    private emailAuth: AppEmailAuth | null = null;
    private emailConnect: AppEmailConnect | null = null;

    constructor(options: AppServerOptions) {
        this.config = options.config;
        this.db = options.db;
        this.auth = options.auth;
        this.commandRegistry = options.commandRegistry;
        this.connectorRegistry = options.connectorRegistry;
        this.toolResolver = options.toolResolver;
        this.webhooks = options.webhooks;
        this.users = options.users;
        this.workspaceMembers = options.workspaceMembers;
        this.agentCallbacks = options.agentCallbacks;
        this.eventBus = options.eventBus;
        this.skills = options.skills;
        this.tasksListActive = options.tasksListActive;
        this.tasksListAll = options.tasksListAll;
        this.taskCallbacks = options.taskCallbacks;
        this.todos = options.todos ?? null;
        this.tokenStatsFetch = options.tokenStatsFetch;
        this.documents = options.documents;
        this.fragments = options.fragments;
        this.keyValues = options.keyValues;
        this.psql = options.psql ?? null;
        this.observationLog = options.observationLog;
        this.miniApps = options.miniApps ?? null;
        this.secrets = options.secrets;
        this.agentSystem = options.agentSystem ?? null;
        this.connectorTargetResolve = options.connectorTargetResolve;
    }

    async start(): Promise<void> {
        await this.settingsApply();
    }

    async reload(): Promise<void> {
        await this.settingsApply();
    }

    async stop(): Promise<void> {
        await this.shutdown();
    }

    private async settingsApply(): Promise<void> {
        const next = appServerSettingsResolve(this.config.current.settings.appServer);
        const nextEmail = this.config.current.settings.email ?? null;
        if (!next.enabled) {
            await this.shutdown();
            return;
        }

        if (
            this.server &&
            this.activeSettings &&
            appServerSettingsEqual(this.activeSettings, next) &&
            emailSettingsEqual(this.activeEmailSettings, nextEmail)
        ) {
            return;
        }

        await this.shutdown();
        this.activeSettings = next;
        this.activeEmailSettings = nextEmail;

        try {
            await this.secretResolve();
            this.registerRuntime();
            this.server = http.createServer((request, response) => {
                void this.requestHandle(request, response).catch((error: unknown) => {
                    this.logger.warn({ error }, "error: Daycare app server request failed");
                    if (response.headersSent) {
                        response.destroy();
                        return;
                    }
                    appSendJson(response, 500, {
                        ok: false,
                        error: "Daycare app request failed."
                    });
                });
            });
            await appServerListen(this.server, next.host, next.port);
            this.logger.info(
                { host: next.host, port: next.port },
                `Daycare app server listening on http://${next.host}:${next.port}`
            );
        } catch (error) {
            await this.shutdown();
            throw error;
        }
    }

    private async requestHandle(request: http.IncomingMessage, response: http.ServerResponse): Promise<void> {
        const settings = this.settingsRequire();

        appCorsApply(response);
        if (request.method === "OPTIONS") {
            response.writeHead(204);
            response.end();
            return;
        }

        const requestUrl = new URL(request.url ?? "/", `http://${settings.host}`);
        const pathname = requestUrl.pathname;

        if (pathname === "/auth/validate" && request.method === "POST") {
            await routeAuthValidate(request, response, {
                secretResolve: () => this.secretResolve(),
                sessionUserIdNormalize: (userId) => this.sessionAuthUserIdNormalize(userId)
            });
            return;
        }
        if (pathname === "/auth/refresh" && request.method === "POST") {
            await routeAuthRefresh(request, response, {
                secretResolve: () => this.secretResolve(),
                sessionUserIdNormalize: (userId) => this.sessionAuthUserIdNormalize(userId)
            });
            return;
        }
        if (pathname === "/auth/telegram" && request.method === "POST") {
            await routeAuthTelegram(request, response, {
                secretResolve: () => this.secretResolve(),
                telegramTokenResolve: (requestedInstanceId) => this.telegramTokenResolve(requestedInstanceId),
                userIdResolve: (telegramUserId) => this.telegramAuthUserIdResolve(telegramUserId)
            });
            return;
        }
        if (pathname === "/auth/email/request" && request.method === "POST") {
            await routeAuthEmailRequest(request, response, {
                emailAuth: await this.emailAuthResolve()
            });
            return;
        }
        if (pathname === "/auth/email/verify" && request.method === "POST") {
            await routeAuthEmailVerify(request, response, {
                emailAuth: await this.emailAuthResolve(),
                secretResolve: () => this.secretResolve()
            });
            return;
        }
        if (pathname === "/auth/email/connect/verify" && request.method === "POST") {
            await routeAuthEmailConnectVerify(request, response, {
                emailConnect: await this.emailConnectResolve()
            });
            return;
        }

        const webhookToken = webhookTokenResolve(pathname);
        if (request.method === "POST" && webhookToken) {
            await routeWebhookTrigger(request, response, webhookToken, {
                secretResolve: () => this.secretResolve(),
                trigger: this.webhooks.trigger.bind(this.webhooks)
            });
            return;
        }

        if (
            request.method === "GET" &&
            (await miniAppServe({
                requestPathname: pathname,
                response,
                secret: await this.secretResolve(),
                rootDirectoryResolve: async (userId, appId, version) =>
                    this.miniApps?.versionDirectoryForUserVersion(userId, appId, version) ?? null
            }))
        ) {
            return;
        }

        if (pathname === "/") {
            appSendText(response, 200, "Welcome to Daycare App API!");
            return;
        }

        const auth = await appAuthExtract(request, () => this.secretResolve());
        if (!auth) {
            appSendJson(response, 401, { ok: false, error: "Authentication required." });
            return;
        }

        // Resolve workspace scope from /w/{userId}/... prefix
        let effectiveUserId = auth.userId;
        let routePathname = pathname;

        if (pathname.startsWith("/w/") && this.users) {
            try {
                const resolved = await appWorkspaceResolve(
                    pathname,
                    auth.userId,
                    this.users,
                    this.workspaceMembers ?? undefined
                );
                if (resolved) {
                    effectiveUserId = resolved.workspaceUserId;
                    routePathname = resolved.strippedPathname;
                }
            } catch (error) {
                if (error instanceof WorkspaceAccessError) {
                    appSendJson(response, 403, { ok: false, error: error.message });
                    return;
                }
                throw error;
            }
        }

        // Profile is always scoped to the authenticated user, not the workspace
        const callerCtx = contextForUser({ userId: auth.userId });
        const ctx = contextForUser({ userId: effectiveUserId });
        // Workspace config is scoped to the effective (workspace) user
        const initialEvents = routePathname === "/events" ? await this.eventsInitialResolve(effectiveUserId) : [];

        const eventsHandled = await eventsRouteHandle(request, response, routePathname, {
            eventBus: this.eventBus,
            userId: effectiveUserId,
            initialEvents,
            eventFilter: (event) => this.eventsVisible(event, effectiveUserId, auth.userId),
            sendJson: appSendJson
        });
        if (eventsHandled) {
            return;
        }

        // Profile and workspaces list use the caller's own context (global, not workspace-scoped)
        const profileCtx = routePathname.startsWith("/profile") ? callerCtx : ctx;
        const workspacesCtx = routePathname.startsWith("/workspaces") ? callerCtx : ctx;
        const publicEndpoints = appRequestEndpointsResolve({
            host: settings.host,
            port: settings.port,
            appEndpoint: settings.appEndpoint,
            serverEndpoint: settings.serverEndpoint,
            headers: request.headers
        });

        const skillsList = this.skills;
        const handled = await apiRouteHandle(request, response, routePathname, {
            ctx: routePathname.startsWith("/profile")
                ? profileCtx
                : routePathname.startsWith("/workspaces")
                  ? workspacesCtx
                  : ctx,
            usersDir: this.config.current.usersDir,
            sendJson: appSendJson,
            readJsonBody: appReadJsonBody,
            users: this.users,
            workspaceMembers: this.workspaceMembers,
            agentCallbacks: this.agentCallbacks,
            eventBus: this.eventBus,
            skills: skillsList
                ? {
                      list: () => skillsList(ctx)
                  }
                : null,
            tools: {
                list: () => this.toolResolver.listTools()
            },
            tasksListActive: this.tasksListActive,
            tasksListAll: this.tasksListAll,
            taskCallbacks: this.taskCallbacks,
            todos: this.todos,
            tokenStatsFetch: this.tokenStatsFetch,
            documents: this.documents,
            fragments: this.fragments,
            keyValues: this.keyValues,
            miniApps: this.miniApps,
            psql: this.psql,
            observationLog: this.observationLog,
            publicEndpoints,
            secretResolve: () => this.secretResolve(),
            secrets: this.secrets,
            emailConnectRequest: (userId, email) => this.emailConnectRequest(userId, email, request.headers),
            miniAppLaunch: this.miniApps
                ? async (requestCtx, id) => {
                      const app = await this.miniApps!.find(requestCtx, id);
                      if (!app) {
                          throw new Error("Mini app not found.");
                      }
                      const token = await miniAppTokenSign(
                          {
                              userId: requestCtx.userId,
                              appId: app.id,
                              version: app.version
                          },
                          await this.secretResolve(),
                          MINI_APP_TOKEN_TTL_SECONDS
                      );
                      return {
                          launchPath: `/mini-apps/s/${encodeURIComponent(token)}/`,
                          expiresAt: Date.now() + MINI_APP_TOKEN_TTL_SECONDS * 1000
                      };
                  }
                : null,
            miniAppExec: this.miniApps && this.agentSystem
                ? async (requestCtx, appId, code) => {
                      return miniAppExec({
                          ctx: requestCtx,
                          appId,
                          code,
                          agentSystem: this.agentSystem!,
                          toolResolver: this.toolResolver
                      });
                  }
                : null
        });
        if (handled) {
            return;
        }

        appSendJson(response, 404, { ok: false, error: "Not found." });
    }

    private async telegramTokenResolve(requestedInstanceId?: string): Promise<string> {
        const settings = this.settingsRequire();
        const configuredInstanceId = settings.telegramInstanceId?.trim();
        const enabledTelegramInstances = (this.config.current.settings.plugins ?? [])
            .filter((entry) => entry.pluginId === "telegram" && entry.enabled !== false)
            .map((entry) => entry.instanceId);
        const requested = requestedInstanceId?.trim();
        const preferred =
            requested ??
            configuredInstanceId ??
            enabledTelegramInstances[0] ??
            (requested === undefined ? "telegram" : "");

        if (!preferred) {
            throw new Error("Telegram plugin instance id is required.");
        }

        if (requested && enabledTelegramInstances.length > 0 && !enabledTelegramInstances.includes(requested)) {
            throw new Error(`Telegram plugin instance "${requested}" is not enabled.`);
        }

        const token = await this.auth.getToken(preferred);
        if (!token) {
            throw new Error(`Missing Telegram bot token for plugin instance "${preferred}".`);
        }

        return token;
    }

    private async telegramAuthUserIdResolve(telegramUserId: string): Promise<string> {
        const users = this.users;
        if (!users) {
            throw new Error("User repository is unavailable.");
        }
        return this.userIdResolveByTelegramConnectorKey(users, telegramUserId);
    }

    private async eventsInitialResolve(userId: string): Promise<EngineEvent[]> {
        const configuration = await this.userConfigurationResolve(userId);
        if (!configuration) {
            return [];
        }
        return [userConfigurationSyncEventBuild(userId, configuration)];
    }

    private eventsVisible(event: EngineEvent, effectiveUserId: string, _callerUserId: string): boolean {
        if (!event.userId) {
            return true;
        }
        return event.userId === effectiveUserId;
    }

    private async sessionAuthUserIdNormalize(userId: string): Promise<string> {
        const users = this.users;
        const normalizedUserId = userId.trim();
        if (!users || !normalizedUserId) {
            return normalizedUserId;
        }

        const existing = await users.findById(normalizedUserId);
        if (existing) {
            return existing.id;
        }
        if (!/^[0-9]+$/.test(normalizedUserId)) {
            return normalizedUserId;
        }
        return this.userIdResolveByTelegramConnectorKey(users, normalizedUserId);
    }

    private async userIdResolveByTelegramConnectorKey(users: UsersRepository, telegramUserId: string): Promise<string> {
        const connectorKey = userConnectorKeyCreate("telegram", telegramUserId);
        const existing = await users.findByConnectorKey(connectorKey);
        if (existing) {
            return existing.id;
        }

        try {
            const created = await users.create({
                connectorKey
            });
            return created.id;
        } catch (error) {
            const raced = await users.findByConnectorKey(connectorKey);
            if (raced) {
                return raced.id;
            }
            throw error;
        }
    }

    private async userConfigurationResolve(userId: string): Promise<UserConfiguration | null> {
        const users = this.users;
        if (!users) {
            return null;
        }
        const user = await users.findById(userId);
        return user?.configuration ?? null;
    }

    private async secretResolve(): Promise<string> {
        const settings = this.settingsRequire();
        if (!this.secretPromise) {
            this.secretPromise = appJwtSecretResolve(settings.jwtSecret, this.auth);
        }
        return this.secretPromise;
    }

    private async emailAuthResolve(): Promise<AppEmailAuth> {
        if (this.emailAuth) {
            return this.emailAuth;
        }

        const settings = this.settingsRequire();
        const users = this.users;
        const email = this.activeEmailSettings;
        const smtpUrl = email?.smtpUrl?.trim() ?? "";
        const from = email?.from?.trim() ?? "";
        if (!users) {
            throw new Error("User repository is unavailable.");
        }
        if (!smtpUrl || !from) {
            throw new Error("email.smtpUrl and email.from are required.");
        }

        this.emailAuth = new AppEmailAuth({
            db: this.db,
            users,
            host: settings.host,
            port: settings.port,
            serverEndpoint: settings.serverEndpoint,
            appEndpoint: settings.appEndpoint,
            secret: await this.secretResolve(),
            replyTo: email?.replyTo,
            mailSend: emailSend({
                smtpUrl,
                from
            })
        });
        return this.emailAuth;
    }

    private async emailConnectResolve(): Promise<AppEmailConnect> {
        if (this.emailConnect) {
            return this.emailConnect;
        }

        const settings = this.settingsRequire();
        const users = this.users;
        const email = this.activeEmailSettings;
        const smtpUrl = email?.smtpUrl?.trim() ?? "";
        const from = email?.from?.trim() ?? "";
        if (!users) {
            throw new Error("User repository is unavailable.");
        }
        if (!smtpUrl || !from) {
            throw new Error("email.smtpUrl and email.from are required.");
        }

        this.emailConnect = new AppEmailConnect({
            users,
            host: settings.host,
            port: settings.port,
            serverEndpoint: settings.serverEndpoint,
            appEndpoint: settings.appEndpoint,
            secret: await this.secretResolve(),
            replyTo: email?.replyTo,
            mailSend: emailSend({
                smtpUrl,
                from
            })
        });
        return this.emailConnect;
    }

    private async emailConnectRequest(userId: string, email: string, headers: http.IncomingHttpHeaders): Promise<void> {
        const emailConnect = await this.emailConnectResolve();
        await emailConnect.request(userId, email, headers);
    }

    private registerRuntime(): void {
        const settings = this.settingsRequire();

        const linkTool = appAuthLinkTool({
            host: settings.host,
            port: settings.port,
            appEndpoint: settings.appEndpoint,
            serverEndpoint: settings.serverEndpoint,
            secretResolve: () => this.secretResolve()
        });

        this.toolResolver.register(APP_SERVER_OWNER, linkTool);
        this.commandRegistry.register(APP_SERVER_OWNER, {
            command: "app",
            description: "Get a link to open the Daycare app",
            handler: async (_command, context, target) => {
                const path = this.pathFromConnectorTarget(target);
                if (!path) {
                    return;
                }
                const userId = pathUserIdResolve(path);
                const connectorTarget = userId ? await this.connectorTargetResolve(path) : null;
                if (!userId || !connectorTarget) {
                    return;
                }
                const link = await appAuthLinkGenerate({
                    host: settings.host,
                    port: settings.port,
                    appEndpoint: settings.appEndpoint,
                    serverEndpoint: settings.serverEndpoint,
                    userId,
                    secret: await this.secretResolve(),
                    expiresInSeconds: APP_AUTH_LINK_EXPIRES_IN_SECONDS
                });
                const connector = connectorTarget.connector;
                if (connector === "telegram") {
                    await this.messageSend(path, context, {
                        text: "Open your Daycare app using the button below.",
                        buttons: [
                            {
                                type: "url",
                                text: "Open Daycare",
                                url: link.url,
                                openMode: "browser"
                            }
                        ]
                    });
                    return;
                }
                await this.messageSend(path, context, {
                    text: `Open your Daycare app: ${link.url}`
                });
            }
        });
    }

    private async shutdown(): Promise<void> {
        this.commandRegistry.unregister("app");
        this.toolResolver.unregister("app_auth_link");
        this.activeEmailSettings = null;
        this.secretPromise = null;
        this.emailAuth = null;
        this.emailConnect = null;

        if (!this.server) {
            this.activeSettings = null;
            return;
        }

        await appServerClose(this.server);
        this.server = null;
        this.activeSettings = null;
    }

    private async messageSend(
        path: AgentPath,
        context: { messageId?: string },
        message: ConnectorMessage
    ): Promise<void> {
        const target = await this.connectorTargetResolve(path);
        if (!target) {
            return;
        }
        const connector = this.connectorRegistry.get(target.connector);
        if (!connector?.capabilities.sendText) {
            return;
        }
        await connector.sendMessage(target.targetId, {
            ...message,
            replyToMessageId: context.messageId
        });
    }

    private pathFromConnectorTarget(target: ConnectorTarget): AgentPath | null {
        return target as AgentPath;
    }

    private settingsRequire(): AppServerResolvedSettings {
        if (!this.activeSettings) {
            throw new Error("App server settings are not loaded.");
        }
        return this.activeSettings;
    }
}

function webhookTokenResolve(pathname: string): string | null {
    const parts = pathname.split("/").filter((part) => part.length > 0);
    if (parts.length !== 3 || parts[0] !== "v1" || parts[1] !== "webhooks") {
        return null;
    }
    const webhookToken = parts[2] ?? "";
    const normalized = webhookToken.trim();
    return normalized.length > 0 ? normalized : null;
}

function pathUserIdResolve(path: AgentPath): string | null {
    const segments = String(path)
        .split("/")
        .filter((segment) => segment.length > 0);
    const first = segments[0]?.trim() ?? "";
    if (!first) {
        return null;
    }
    return first;
}

function appServerSettingsEqual(left: AppServerResolvedSettings, right: AppServerResolvedSettings): boolean {
    return (
        left.enabled === right.enabled &&
        left.host === right.host &&
        left.port === right.port &&
        left.appEndpoint === right.appEndpoint &&
        left.serverEndpoint === right.serverEndpoint &&
        left.jwtSecret === right.jwtSecret &&
        left.telegramInstanceId === right.telegramInstanceId
    );
}

function emailSettingsEqual(left: EmailSettings | null, right: EmailSettings | null): boolean {
    return (
        (left?.smtpUrl ?? "") === (right?.smtpUrl ?? "") &&
        (left?.from ?? "") === (right?.from ?? "") &&
        (left?.replyTo ?? "") === (right?.replyTo ?? "")
    );
}