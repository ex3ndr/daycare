import http from "node:http";
import type { AgentPath, AgentSkill, ConnectorMessage, ConnectorTarget, Context, TaskActiveSummary } from "@/types";
import type { AuthStore } from "../../auth/store.js";
import { contextForUser } from "../../engine/agents/context.js";
import type { ConfigModule } from "../../engine/config/configModule.js";
import type { EngineEventBus } from "../../engine/ipc/events.js";
import type { CommandRegistry } from "../../engine/modules/commandRegistry.js";
import type { ConnectorRegistry } from "../../engine/modules/connectorRegistry.js";
import type { ToolResolver } from "../../engine/modules/toolResolver.js";
import type { Webhooks } from "../../engine/webhook/webhooks.js";
import { getLogger } from "../../log.js";
import type { TokenStatsHourlyDbRecord } from "../../storage/databaseTypes.js";
import type { DocumentsRepository } from "../../storage/documentsRepository.js";
import type { UsersRepository } from "../../storage/usersRepository.js";
import type { TokenStatsFetchOptions } from "../routes/costs/costsRoutes.js";
import { eventsRouteHandle } from "../routes/events/eventsRoutes.js";
import { apiRouteHandle } from "../routes/routes.js";
import type { RouteAgentCallbacks, RouteTaskCallbacks } from "../routes/routeTypes.js";
import { appAuthExtract } from "./appAuthExtract.js";
import { APP_AUTH_LINK_EXPIRES_IN_SECONDS, appAuthLinkGenerate, appAuthLinkTool } from "./appAuthLinkTool.js";
import { appCorsApply, appReadJsonBody, appSendJson, appSendText, appServerClose, appServerListen } from "./appHttp.js";
import { appJwtSecretResolve } from "./appJwtSecretResolve.js";
import type { AppServerResolvedSettings } from "./appServerSettingsResolve.js";
import { appServerSettingsResolve } from "./appServerSettingsResolve.js";
import { routeAuthRefresh } from "./routes/routeAuthRefresh.js";
import { routeAuthTelegram } from "./routes/routeAuthTelegram.js";
import { routeAuthValidate } from "./routes/routeAuthValidate.js";
import { routeWebhookTrigger } from "./routes/routeWebhookTrigger.js";

const APP_SERVER_OWNER = "core.app-server";

export type AppServerOptions = {
    config: ConfigModule;
    auth: AuthStore;
    commandRegistry: CommandRegistry;
    connectorRegistry: ConnectorRegistry;
    toolResolver: ToolResolver;
    webhooks: Webhooks;
    users: UsersRepository | null;
    agentCallbacks: RouteAgentCallbacks | null;
    eventBus: EngineEventBus | null;
    skills: ((ctx: Context) => Promise<AgentSkill[]>) | null;
    tasksListActive: (ctx: Context) => Promise<TaskActiveSummary[]>;
    taskCallbacks: RouteTaskCallbacks | null;
    tokenStatsFetch: (ctx: Context, options: TokenStatsFetchOptions) => Promise<TokenStatsHourlyDbRecord[]>;
    documents: DocumentsRepository | null;
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
    private readonly auth: AuthStore;
    private readonly commandRegistry: CommandRegistry;
    private readonly connectorRegistry: ConnectorRegistry;
    private readonly toolResolver: ToolResolver;
    private readonly webhooks: Webhooks;
    private readonly users: UsersRepository | null;
    private readonly agentCallbacks: RouteAgentCallbacks | null;
    private readonly eventBus: EngineEventBus | null;
    private readonly skills: ((ctx: Context) => Promise<AgentSkill[]>) | null;
    private readonly tasksListActive: AppServerOptions["tasksListActive"];
    private readonly taskCallbacks: RouteTaskCallbacks | null;
    private readonly tokenStatsFetch: AppServerOptions["tokenStatsFetch"];
    private readonly documents: DocumentsRepository | null;
    private readonly connectorTargetResolve: AppServerOptions["connectorTargetResolve"];
    private readonly logger = getLogger("api.app-server");

    private server: http.Server | null = null;
    private activeSettings: AppServerResolvedSettings | null = null;
    private secretPromise: Promise<string> | null = null;

    constructor(options: AppServerOptions) {
        this.config = options.config;
        this.auth = options.auth;
        this.commandRegistry = options.commandRegistry;
        this.connectorRegistry = options.connectorRegistry;
        this.toolResolver = options.toolResolver;
        this.webhooks = options.webhooks;
        this.users = options.users;
        this.agentCallbacks = options.agentCallbacks;
        this.eventBus = options.eventBus;
        this.skills = options.skills;
        this.tasksListActive = options.tasksListActive;
        this.taskCallbacks = options.taskCallbacks;
        this.tokenStatsFetch = options.tokenStatsFetch;
        this.documents = options.documents;
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
        if (!next.enabled) {
            await this.shutdown();
            return;
        }

        if (this.server && this.activeSettings && appServerSettingsEqual(this.activeSettings, next)) {
            return;
        }

        await this.shutdown();
        this.activeSettings = next;

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
            await routeAuthValidate(request, response, () => this.secretResolve());
            return;
        }
        if (pathname === "/auth/refresh" && request.method === "POST") {
            await routeAuthRefresh(request, response, {
                secretResolve: () => this.secretResolve()
            });
            return;
        }
        if (pathname === "/auth/telegram" && request.method === "POST") {
            await routeAuthTelegram(request, response, {
                secretResolve: () => this.secretResolve(),
                telegramTokenResolve: (requestedInstanceId) => this.telegramTokenResolve(requestedInstanceId)
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

        if (pathname === "/") {
            appSendText(response, 200, "Welcome to Daycare App API!");
            return;
        }

        const auth = await appAuthExtract(request, () => this.secretResolve());
        if (!auth) {
            appSendJson(response, 401, { ok: false, error: "Authentication required." });
            return;
        }

        const ctx = contextForUser({ userId: auth.userId });
        const eventsHandled = await eventsRouteHandle(request, response, pathname, {
            eventBus: this.eventBus,
            sendJson: appSendJson
        });
        if (eventsHandled) {
            return;
        }

        const skillsList = this.skills;
        const handled = await apiRouteHandle(request, response, pathname, {
            ctx,
            usersDir: this.config.current.usersDir,
            sendJson: appSendJson,
            readJsonBody: appReadJsonBody,
            users: this.users,
            agentCallbacks: this.agentCallbacks,
            eventBus: this.eventBus,
            skills: skillsList
                ? {
                      list: () => skillsList(ctx)
                  }
                : null,
            tasksListActive: this.tasksListActive,
            taskCallbacks: this.taskCallbacks,
            tokenStatsFetch: this.tokenStatsFetch,
            documents: this.documents
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

    private async secretResolve(): Promise<string> {
        const settings = this.settingsRequire();
        if (!this.secretPromise) {
            this.secretPromise = appJwtSecretResolve(settings.jwtSecret, this.auth);
        }
        return this.secretPromise;
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
                                text: "Open Daycare",
                                url: link.url
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
        this.secretPromise = null;

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
