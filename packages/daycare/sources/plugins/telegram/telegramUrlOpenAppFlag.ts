import { APP_AUTH_DEFAULT_ENDPOINT } from "../../api/app-server/appAuthLinkTool.js";

const TELEGRAM_OPEN_APP_QUERY_PARAM = "openApp";
const TELEGRAM_OPEN_APP_QUERY_VALUE = "1";

/**
 * Adds Telegram app-open URL flag for Daycare frontend links.
 * Expects: url is absolute; webAppUrl is optional configured Telegram app frontend URL.
 */
export function telegramUrlOpenAppFlag(url: string, webAppUrl?: string | null): string {
    const parsedUrl = parseUrl(url);
    if (!parsedUrl) {
        return url;
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

    if (!allowedOrigins.has(parsedUrl.origin)) {
        return url;
    }

    parsedUrl.searchParams.set(TELEGRAM_OPEN_APP_QUERY_PARAM, TELEGRAM_OPEN_APP_QUERY_VALUE);
    return parsedUrl.toString();
}

function parseUrl(value: string): URL | null {
    try {
        return new URL(value);
    } catch {
        return null;
    }
}
