import { APP_AUTH_DEFAULT_ENDPOINT } from "../../api/app-server/appAuthLinkTool.js";
import { appEndpointNormalize } from "../../api/app-server/appEndpointNormalize.js";
import type { SettingsConfig } from "../../settings.js";

/**
 * Resolves Telegram WebApp URL when app server is enabled.
 * Expects: engineSettings are normalized settings and telegramInstanceId is non-empty.
 */
export function telegramWebAppUrlResolve(engineSettings: SettingsConfig, telegramInstanceId: string): string | null {
    const appServerSettings = engineSettings.appServer;
    if (appServerSettings?.enabled !== true) {
        return null;
    }

    const appEndpoint = appEndpointNormalize(valueAsString(appServerSettings?.appEndpoint), "appEndpoint");
    const serverEndpoint = appEndpointNormalize(valueAsString(appServerSettings?.serverEndpoint), "serverEndpoint");
    const appBaseUrl = appEndpoint ?? serverEndpoint ?? APP_AUTH_DEFAULT_ENDPOINT;
    const backendUrl = serverEndpoint ?? appBaseUrl;
    return telegramWebAppUrlBuild(appBaseUrl, backendUrl, telegramInstanceId);
}

function telegramWebAppUrlBuild(appBaseUrl: string, backendUrl: string, telegramInstanceId: string): string {
    const url = new URL(appBaseUrl);
    if (url.pathname.endsWith("/") && url.pathname !== "/") {
        url.pathname = url.pathname.slice(0, -1);
    }
    url.searchParams.set("backend", backendUrl);
    url.searchParams.set("telegramInstanceId", telegramInstanceId);
    return url.toString();
}

function valueAsString(value: unknown): string | undefined {
    return typeof value === "string" ? value : undefined;
}
