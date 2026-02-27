import type { SettingsConfig } from "../../settings.js";
import { APP_AUTH_DEFAULT_ENDPOINT } from "../daycare-app-server/appAuthLinkTool.js";
import { appEndpointNormalize } from "../daycare-app-server/appEndpointNormalize.js";

/**
 * Resolves Telegram WebApp URL when daycare-app-server is enabled.
 * Expects: engineSettings are normalized plugin settings and telegramInstanceId is non-empty.
 */
export function telegramWebAppUrlResolve(engineSettings: SettingsConfig, telegramInstanceId: string): string | null {
    const appServer = (engineSettings.plugins ?? []).find(
        (entry) => entry.pluginId === "daycare-app-server" && entry.enabled !== false
    );
    if (!appServer) {
        return null;
    }

    const pluginSettings = (appServer.settings ?? {}) as Record<string, unknown>;
    const appEndpoint = appEndpointNormalize(valueAsString(pluginSettings.appEndpoint), "appEndpoint");
    const serverEndpoint = appEndpointNormalize(valueAsString(pluginSettings.serverEndpoint), "serverEndpoint");
    const appBaseUrl = appEndpoint ?? serverEndpoint ?? APP_AUTH_DEFAULT_ENDPOINT;
    const backendUrl = serverEndpoint ?? appBaseUrl;
    return telegramWebAppAuthUrlBuild(appBaseUrl, backendUrl, telegramInstanceId);
}

function telegramWebAppAuthUrlBuild(appBaseUrl: string, backendUrl: string, telegramInstanceId: string): string {
    const url = new URL(appBaseUrl);
    const normalizedPath = url.pathname.endsWith("/") ? url.pathname.slice(0, -1) : url.pathname;
    url.pathname = `${normalizedPath || ""}/auth`;
    url.searchParams.set("backend", backendUrl);
    url.searchParams.set("telegramInstanceId", telegramInstanceId);
    return url.toString();
}

function valueAsString(value: unknown): string | undefined {
    return typeof value === "string" ? value : undefined;
}
