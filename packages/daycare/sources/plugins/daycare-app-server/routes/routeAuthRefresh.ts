import type http from "node:http";
import { jwtVerify } from "../../../util/jwt.js";
import { APP_AUTH_EXPIRES_IN_SECONDS, appAuthLinkGenerate } from "../appAuthLinkTool.js";
import { appReadJsonBody, appSendJson } from "../appHttp.js";

export type RouteAuthRefreshOptions = {
    secretResolve: () => Promise<string>;
    host: string;
    port: number;
    appEndpoint?: string;
    serverEndpoint?: string;
};

/**
 * Handles POST /auth/refresh — validates a token and returns a fresh one.
 * Expects: options contains host/port and secretResolve for JWT signing.
 */
export async function routeAuthRefresh(
    request: http.IncomingMessage,
    response: http.ServerResponse,
    options: RouteAuthRefreshOptions
): Promise<void> {
    const body = await appReadJsonBody(request);
    const token = typeof body.token === "string" ? body.token.trim() : "";
    if (!token) {
        appSendJson(response, 200, { ok: false, error: "Token is required." });
        return;
    }

    try {
        const secret = await options.secretResolve();
        const payload = await jwtVerify(token, secret);
        const refreshed = await appAuthLinkGenerate({
            host: options.host,
            port: options.port,
            appEndpoint: options.appEndpoint,
            serverEndpoint: options.serverEndpoint,
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
