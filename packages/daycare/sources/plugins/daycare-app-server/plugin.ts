import http from "node:http";
import { z } from "zod";
import { apiRouteHandle } from "../../api/routes.js";
import { contextForUser } from "../../engine/agents/context.js";
import { definePlugin } from "../../engine/plugins/types.js";
import { appAuthExtract } from "./appAuthExtract.js";
import { APP_AUTH_EXPIRES_IN_SECONDS, appAuthLinkGenerate, appAuthLinkTool } from "./appAuthLinkTool.js";
import { appEndpointNormalize } from "./appEndpointNormalize.js";
import { appCorsApply, appReadJsonBody, appSendJson, appSendText, appServerClose, appServerListen } from "./appHttp.js";
import { appJwtSecretResolve } from "./appJwtSecretResolve.js";
import { routeAuthRefresh } from "./routes/routeAuthRefresh.js";
import { routeAuthTelegram } from "./routes/routeAuthTelegram.js";
import { routeAuthValidate } from "./routes/routeAuthValidate.js";

const APP_DEFAULT_HOST = "127.0.0.1";
const APP_DEFAULT_PORT = 7332;

const settingsSchema = z
    .object({
        host: z.string().trim().min(1).default(APP_DEFAULT_HOST),
        port: z.coerce.number().int().min(1).max(65535).default(APP_DEFAULT_PORT),
        appEndpoint: appEndpointSettingSchema("appEndpoint"),
        serverEndpoint: appEndpointSettingSchema("serverEndpoint"),
        jwtSecret: z.string().trim().min(32).optional(),
        telegramInstanceId: z.string().trim().min(1).optional()
    })
    .strict();

type DaycareAppServerSettings = z.infer<typeof settingsSchema>;

export const plugin = definePlugin({
    settingsSchema,
    create: (api) => {
        const settings = api.settings as DaycareAppServerSettings;
        const usersDir = api.usersDir;

        let server: http.Server | null = null;
        let secretPromise: Promise<string> | null = null;

        const secretResolve = async (): Promise<string> => {
            if (!secretPromise) {
                secretPromise = appJwtSecretResolve(settings.jwtSecret, api.auth);
            }
            return secretPromise;
        };

        const telegramTokenResolve = async (requestedInstanceId?: string): Promise<string> => {
            const configuredInstanceId = settings.telegramInstanceId?.trim();
            const enabledTelegramInstances = (api.engineSettings.plugins ?? [])
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

            const token = await api.auth.getToken(preferred);
            if (!token) {
                throw new Error(`Missing Telegram bot token for plugin instance "${preferred}".`);
            }

            return token;
        };

        const handleRequest = async (request: http.IncomingMessage, response: http.ServerResponse): Promise<void> => {
            appCorsApply(response);
            if (request.method === "OPTIONS") {
                response.writeHead(204);
                response.end();
                return;
            }

            const requestUrl = new URL(request.url ?? "/", `http://${settings.host}`);
            const pathname = requestUrl.pathname;

            // Auth routes (unauthenticated — they validate tokens themselves)
            if (pathname === "/auth/validate" && request.method === "POST") {
                await routeAuthValidate(request, response, secretResolve);
                return;
            }
            if (pathname === "/auth/refresh" && request.method === "POST") {
                await routeAuthRefresh(request, response, {
                    secretResolve,
                    host: settings.host,
                    port: settings.port,
                    appEndpoint: settings.appEndpoint,
                    serverEndpoint: settings.serverEndpoint
                });
                return;
            }
            if (pathname === "/auth/telegram" && request.method === "POST") {
                await routeAuthTelegram(request, response, {
                    secretResolve,
                    telegramTokenResolve
                });
                return;
            }

            // Root welcome
            if (pathname === "/") {
                appSendText(response, 200, "Welcome to Daycare App API!");
                return;
            }

            // Authenticated API routes below
            const auth = await appAuthExtract(request, secretResolve);
            if (!auth) {
                appSendJson(response, 401, { ok: false, error: "Authentication required." });
                return;
            }

            const ctx = contextForUser({ userId: auth.userId });
            const handled = await apiRouteHandle(request, response, pathname, {
                ctx,
                usersDir,
                sendJson: appSendJson,
                readJsonBody: appReadJsonBody
            });
            if (handled) {
                return;
            }

            appSendJson(response, 404, { ok: false, error: "Not found." });
        };

        return {
            load: async () => {
                const linkTool = appAuthLinkTool({
                    host: settings.host,
                    port: settings.port,
                    appEndpoint: settings.appEndpoint,
                    serverEndpoint: settings.serverEndpoint,
                    secretResolve
                });

                const appCommandHandler = async (
                    _command: string,
                    context: { messageId?: string },
                    descriptor: { type: string; userId?: string }
                ) => {
                    if (descriptor.type !== "user" || typeof descriptor.userId !== "string") {
                        return;
                    }

                    const link = await appAuthLinkGenerate({
                        host: settings.host,
                        port: settings.port,
                        appEndpoint: settings.appEndpoint,
                        serverEndpoint: settings.serverEndpoint,
                        userId: descriptor.userId,
                        secret: await secretResolve(),
                        expiresInSeconds: APP_AUTH_EXPIRES_IN_SECONDS
                    });

                    await api.registrar.sendMessage(descriptor as never, context, {
                        text: `Open your Daycare app: ${link.url}`
                    });
                };

                api.registrar.registerTool(linkTool);
                api.registrar.registerCommand({
                    command: "app",
                    description: "Get a link to open the Daycare app",
                    handler: appCommandHandler as never
                });

                server = http.createServer((request, response) => {
                    void handleRequest(request, response).catch((error: unknown) => {
                        api.logger.warn({ error }, "error: Daycare app server request failed");
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

                await appServerListen(server, settings.host, settings.port);
                api.logger.info(
                    {
                        host: settings.host,
                        port: settings.port
                    },
                    `Daycare app server listening on http://${settings.host}:${settings.port}`
                );
            },
            unload: async () => {
                api.registrar.unregisterCommand("app");
                api.registrar.unregisterTool("app_auth_link");

                if (!server) {
                    return;
                }

                await appServerClose(server);
                server = null;
            }
        };
    }
});

function appEndpointSettingSchema(fieldName: string): z.ZodEffects<z.ZodOptional<z.ZodString>, string | undefined> {
    return z
        .string()
        .trim()
        .min(1)
        .optional()
        .transform((value, context) => {
            try {
                return appEndpointNormalize(value, fieldName);
            } catch (error) {
                context.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: error instanceof Error ? error.message : `Invalid ${fieldName}.`
                });
                return z.NEVER;
            }
        });
}
