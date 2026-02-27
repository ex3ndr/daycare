import { createReadStream, promises as fs } from "node:fs";
import http from "node:http";
import path from "node:path";
import { pipeline } from "node:stream/promises";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { resolveEngineSocketPath } from "../../engine/ipc/socket.js";
import { definePlugin } from "../../engine/plugins/types.js";
import { jwtVerify } from "../../util/jwt.js";
import { APP_AUTH_EXPIRES_IN_SECONDS, appAuthLinkGenerate, appAuthLinkTool } from "./appAuthLinkTool.js";
import { appEndpointNormalize } from "./appEndpointNormalize.js";
import { appJwtSecretResolve } from "./appJwtSecretResolve.js";
import { daycareAppProxyPathResolve } from "./daycareAppProxyPathResolve.js";

const APP_DEFAULT_HOST = "127.0.0.1";
const APP_DEFAULT_PORT = 7332;

const bundledSiteDirectory = fileURLToPath(new URL("./site", import.meta.url));
const workspaceAppDistDirectory = path.resolve(
    fileURLToPath(new URL(".", import.meta.url)),
    "../../../../daycare-app/dist"
);
const workspaceAppWebBuildDirectory = path.resolve(
    fileURLToPath(new URL(".", import.meta.url)),
    "../../../../daycare-app/web-build"
);

const settingsSchema = z
    .object({
        host: z.string().trim().min(1).default(APP_DEFAULT_HOST),
        port: z.coerce.number().int().min(1).max(65535).default(APP_DEFAULT_PORT),
        appEndpoint: appEndpointSettingSchema("appEndpoint"),
        serverDomain: appEndpointSettingSchema("serverDomain"),
        jwtSecret: z.string().trim().min(32).optional()
    })
    .strict();

type DaycareAppServerSettings = z.infer<typeof settingsSchema>;

export const plugin = definePlugin({
    settingsSchema,
    create: (api) => {
        const settings = api.settings as DaycareAppServerSettings;
        const socketPath = resolveEngineSocketPath(api.engineSettings.engine?.socketPath);

        let server: http.Server | null = null;
        let secretPromise: Promise<string> | null = null;

        const secretResolve = async (): Promise<string> => {
            if (!secretPromise) {
                secretPromise = appJwtSecretResolve(settings.jwtSecret, api.auth);
            }
            return secretPromise;
        };

        const handleRequest = async (request: http.IncomingMessage, response: http.ServerResponse): Promise<void> => {
            appCorsApply(response);
            if (request.method === "OPTIONS") {
                response.writeHead(204);
                response.end();
                return;
            }

            const requestUrl = new URL(request.url ?? "/", `http://${settings.host}`);

            if (requestUrl.pathname === "/auth/validate" && request.method === "POST") {
                await appAuthValidateRoute(request, response, secretResolve);
                return;
            }

            if (requestUrl.pathname === "/auth/refresh" && request.method === "POST") {
                await appAuthRefreshRoute(
                    request,
                    response,
                    secretResolve,
                    settings.host,
                    settings.port,
                    settings.appEndpoint,
                    settings.serverDomain
                );
                return;
            }

            if (requestUrl.pathname.startsWith("/api/")) {
                await appProxyRequest(request, response, socketPath, requestUrl);
                return;
            }

            if (requestUrl.pathname === "/") {
                appSendText(response, 200, "Welcome to Daycare App API!");
                return;
            }

            const siteDirectory = await appSiteDirectoryResolve();
            if (!siteDirectory) {
                appSendJson(response, 503, {
                    ok: false,
                    error: "Daycare app build not found. Build packages/daycare-app first."
                });
                return;
            }

            const assetPath = await appStaticPathResolve(siteDirectory, requestUrl.pathname);
            if (!assetPath) {
                appSendJson(response, 404, {
                    ok: false,
                    error: "App route not found."
                });
                return;
            }
            await appServeFile(response, assetPath);
        };

        return {
            load: async () => {
                const linkTool = appAuthLinkTool({
                    host: settings.host,
                    port: settings.port,
                    appEndpoint: settings.appEndpoint,
                    serverDomain: settings.serverDomain,
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
                        serverDomain: settings.serverDomain,
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

async function appAuthValidateRoute(
    request: http.IncomingMessage,
    response: http.ServerResponse,
    secretResolve: () => Promise<string>
): Promise<void> {
    const body = await appReadJsonBody(request);
    const token = typeof body.token === "string" ? body.token.trim() : "";
    if (!token) {
        appSendJson(response, 200, { ok: false, error: "Token is required." });
        return;
    }

    try {
        const payload = await jwtVerify(token, await secretResolve());
        appSendJson(response, 200, { ok: true, userId: payload.userId });
    } catch (error) {
        appSendJson(response, 200, {
            ok: false,
            error: error instanceof Error ? error.message : "Invalid token"
        });
    }
}

async function appAuthRefreshRoute(
    request: http.IncomingMessage,
    response: http.ServerResponse,
    secretResolve: () => Promise<string>,
    host: string,
    port: number,
    appEndpoint: string | undefined,
    serverDomain: string | undefined
): Promise<void> {
    const body = await appReadJsonBody(request);
    const token = typeof body.token === "string" ? body.token.trim() : "";
    if (!token) {
        appSendJson(response, 200, { ok: false, error: "Token is required." });
        return;
    }

    try {
        const secret = await secretResolve();
        const payload = await jwtVerify(token, secret);
        const refreshed = await appAuthLinkGenerate({
            host,
            port,
            appEndpoint,
            serverDomain,
            userId: payload.userId,
            secret,
            expiresInSeconds: APP_AUTH_EXPIRES_IN_SECONDS
        });
        appSendJson(response, 200, {
            ok: true,
            token: refreshed.token,
            userId: payload.userId,
            url: refreshed.url
        });
    } catch (error) {
        appSendJson(response, 200, {
            ok: false,
            error: error instanceof Error ? error.message : "Invalid token"
        });
    }
}

async function appReadJsonBody(request: http.IncomingMessage): Promise<Record<string, unknown>> {
    const chunks: Buffer[] = [];
    for await (const chunk of request) {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }

    const text = Buffer.concat(chunks).toString("utf8").trim();
    if (!text) {
        return {};
    }

    try {
        const parsed = JSON.parse(text) as Record<string, unknown>;
        return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
        return {};
    }
}

async function appProxyRequest(
    request: http.IncomingMessage,
    response: http.ServerResponse,
    socketPath: string,
    url: URL
): Promise<void> {
    const headers = { ...request.headers };
    delete headers.host;
    delete headers.connection;

    const upstreamPath = daycareAppProxyPathResolve(url.pathname, url.search);

    await new Promise<void>((resolve) => {
        const upstream = http.request(
            {
                socketPath,
                path: upstreamPath,
                method: request.method,
                headers
            },
            (upstreamResponse) => {
                appCorsApply(response);
                response.writeHead(upstreamResponse.statusCode ?? 502, upstreamResponse.headers);
                void pipeline(upstreamResponse, response)
                    .then(() => resolve())
                    .catch(() => {
                        response.destroy();
                        resolve();
                    });
            }
        );

        upstream.on("error", (error) => {
            appSendJson(response, 502, {
                ok: false,
                error: `App API proxy failed: ${error.message}`
            });
            resolve();
        });

        if (request.method === "GET" || request.method === "HEAD") {
            upstream.end();
            return;
        }

        void pipeline(request, upstream).catch(() => {
            upstream.destroy();
        });
    });
}

async function appSiteDirectoryResolve(): Promise<string | null> {
    const candidates = [workspaceAppDistDirectory, workspaceAppWebBuildDirectory, bundledSiteDirectory];

    for (const candidate of candidates) {
        const indexPath = path.join(candidate, "index.html");
        if (await appFileExists(indexPath)) {
            return candidate;
        }
    }

    return null;
}

async function appStaticPathResolve(siteDirectory: string, pathname: string): Promise<string | null> {
    const decoded = appPathDecode(pathname);
    if (!decoded || decoded.includes("\0")) {
        return null;
    }

    const normalized = decoded.replace(/^\/+/, "");
    const candidates = appPathCandidates(normalized);

    for (const candidate of candidates) {
        const targetPath = path.resolve(siteDirectory, candidate);
        if (!appPathWithin(siteDirectory, targetPath)) {
            continue;
        }

        if (await appFileExists(targetPath)) {
            return targetPath;
        }
    }

    return null;
}

function appPathDecode(pathname: string): string | null {
    try {
        return decodeURIComponent(pathname);
    } catch {
        return null;
    }
}

function appPathCandidates(pathname: string): string[] {
    if (!pathname || pathname === "/") {
        return ["index.html"];
    }

    const posixPath = pathname.replace(/\\/g, "/");
    if (posixPath.endsWith("/")) {
        return [path.posix.join(posixPath, "index.html"), "index.html"];
    }

    const candidates = [posixPath];
    if (!path.extname(posixPath)) {
        candidates.push(`${posixPath}.html`, path.posix.join(posixPath, "index.html"), "index.html");
    }
    return candidates;
}

function appPathWithin(basePath: string, targetPath: string): boolean {
    const relative = path.relative(basePath, targetPath);
    return !relative.startsWith("..") && !path.isAbsolute(relative);
}

async function appFileExists(filePath: string): Promise<boolean> {
    try {
        const stat = await fs.stat(filePath);
        return stat.isFile();
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") {
            return false;
        }
        throw error;
    }
}

async function appServeFile(response: http.ServerResponse, filePath: string): Promise<void> {
    appCorsApply(response);
    response.writeHead(200, {
        "content-type": appContentTypeResolve(filePath),
        "cache-control": appCacheControlResolve(filePath)
    });
    await pipeline(createReadStream(filePath), response);
}

function appContentTypeResolve(filePath: string): string {
    const extension = path.extname(filePath).toLowerCase();
    if (extension === ".html") {
        return "text/html; charset=utf-8";
    }
    if (extension === ".css") {
        return "text/css; charset=utf-8";
    }
    if (extension === ".js") {
        return "application/javascript; charset=utf-8";
    }
    if (extension === ".json") {
        return "application/json; charset=utf-8";
    }
    if (extension === ".svg") {
        return "image/svg+xml";
    }
    if (extension === ".png") {
        return "image/png";
    }
    if (extension === ".jpg" || extension === ".jpeg") {
        return "image/jpeg";
    }
    if (extension === ".ico") {
        return "image/x-icon";
    }
    return "application/octet-stream";
}

function appCacheControlResolve(filePath: string): string {
    const normalized = filePath.replace(/\\/g, "/");
    if (normalized.includes("/assets/") || normalized.includes("/_expo/")) {
        return "public, max-age=31536000, immutable";
    }
    return "no-store";
}

function appSendJson(response: http.ServerResponse, statusCode: number, payload: Record<string, unknown>): void {
    appCorsApply(response);
    response.writeHead(statusCode, {
        "content-type": "application/json; charset=utf-8",
        "cache-control": "no-store"
    });
    response.end(`${JSON.stringify(payload)}\n`);
}

function appSendText(response: http.ServerResponse, statusCode: number, text: string): void {
    appCorsApply(response);
    response.writeHead(statusCode, {
        "content-type": "text/plain; charset=utf-8",
        "cache-control": "no-store"
    });
    response.end(text);
}

function appCorsApply(response: http.ServerResponse): void {
    response.setHeader("access-control-allow-origin", "*");
    response.setHeader("access-control-allow-methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
    response.setHeader("access-control-allow-headers", "content-type,authorization");
}

function appServerListen(server: http.Server, host: string, port: number): Promise<void> {
    return new Promise((resolve, reject) => {
        const onError = (error: Error) => {
            server.off("listening", onListening);
            reject(error);
        };
        const onListening = () => {
            server.off("error", onError);
            resolve();
        };

        server.once("error", onError);
        server.once("listening", onListening);
        server.listen({ host, port });
    });
}

function appServerClose(server: http.Server): Promise<void> {
    return new Promise((resolve, reject) => {
        server.close((error) => {
            if (error) {
                reject(error);
                return;
            }
            resolve();
        });
    });
}

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
