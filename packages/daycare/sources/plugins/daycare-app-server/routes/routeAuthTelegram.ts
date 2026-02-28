import type http from "node:http";
import { jwtSign } from "../../../util/jwt.js";
import { APP_AUTH_SESSION_EXPIRES_IN_SECONDS } from "../appAuthLinkTool.js";
import { appReadJsonBody, appSendJson } from "../appHttp.js";
import { appTelegramInitDataValidate } from "../appTelegramInitDataValidate.js";

export type RouteAuthTelegramOptions = {
    secretResolve: () => Promise<string>;
    telegramTokenResolve: (telegramInstanceId?: string) => Promise<string>;
};

/**
 * Handles POST /auth/telegram — validates Telegram WebApp initData and issues a session token.
 * Expects: options resolves the app JWT secret and Telegram bot token for signature verification.
 */
export async function routeAuthTelegram(
    request: http.IncomingMessage,
    response: http.ServerResponse,
    options: RouteAuthTelegramOptions
): Promise<void> {
    const body = await appReadJsonBody(request);
    const initData = typeof body.initData === "string" ? body.initData.trim() : "";
    const telegramInstanceIdRaw = typeof body.telegramInstanceId === "string" ? body.telegramInstanceId.trim() : "";
    const telegramInstanceId = telegramInstanceIdRaw.length > 0 ? telegramInstanceIdRaw : undefined;

    if (!initData) {
        appSendJson(response, 200, { ok: false, error: "Telegram initData is required." });
        return;
    }

    try {
        const botToken = await options.telegramTokenResolve(telegramInstanceId);
        const verified = appTelegramInitDataValidate(initData, botToken);
        const secret = await options.secretResolve();
        const token = await jwtSign({ userId: verified.userId }, secret, APP_AUTH_SESSION_EXPIRES_IN_SECONDS);
        const expiresAt = Date.now() + APP_AUTH_SESSION_EXPIRES_IN_SECONDS * 1000;

        appSendJson(response, 200, {
            ok: true,
            userId: verified.userId,
            token,
            expiresAt
        });
    } catch (error) {
        appSendJson(response, 200, {
            ok: false,
            error: error instanceof Error ? error.message : "Telegram authentication failed."
        });
    }
}
