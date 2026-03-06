import { APP_AUTH_DEFAULT_ENDPOINT } from "../../api/app-server/appAuthLinkTool.js";

/**
 * Checks whether a URL targets the Daycare app origin used for Telegram Mini App launches.
 * Expects: url is absolute when a match is expected; webAppUrl is optional configured Mini App URL.
 */
export function telegramWebAppUrlMatch(url: string, webAppUrl?: string | null): boolean {
    const parsedUrl = parseUrl(url);
    if (!parsedUrl) {
        return false;
    }

    const allowedOrigins = new Set<string>();
    const defaultAppOrigin = parseUrl(APP_AUTH_DEFAULT_ENDPOINT)?.origin;
    if (defaultAppOrigin) {
        allowedOrigins.add(defaultAppOrigin);
    }
    const configuredAppOrigin = parseUrl(webAppUrl ?? "")?.origin;
    if (configuredAppOrigin) {
        allowedOrigins.add(configuredAppOrigin);
    }

    return allowedOrigins.has(parsedUrl.origin);
}

function parseUrl(value: string): URL | null {
    try {
        return new URL(value);
    } catch {
        return null;
    }
}
