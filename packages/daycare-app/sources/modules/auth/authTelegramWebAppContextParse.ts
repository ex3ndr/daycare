export type AuthTelegramWebAppContext = {
    backendUrl: string;
    initData: string;
    telegramInstanceId?: string;
};

/**
 * Parses Telegram WebApp auth context from URL, launch params, and initData.
 * Checks query params, hash fragment, and raw TMA launch params (which preserve the original URL).
 * Expects: backend URL in `backend` param and initData is the raw Telegram WebApp payload.
 */
export function authTelegramWebAppContextParse(
    href: string,
    initDataRaw: string | null | undefined,
    rawLaunchParams?: string | null
): AuthTelegramWebAppContext | null {
    const initData = initDataRaw?.trim() ?? "";
    if (!initData) {
        return null;
    }

    // Try href (query + hash), then raw launch params (preserves original URL params).
    const params = paramsFromHref(href);
    if (rawLaunchParams) {
        for (const [key, value] of new URLSearchParams(rawLaunchParams)) {
            if (!params.has(key)) {
                params.set(key, value);
            }
        }
    }

    const backendUrl = backendUrlNormalize(params.get("backend"));
    if (!backendUrl) {
        return null;
    }

    const telegramInstanceIdRaw = params.get("telegramInstanceId")?.trim() ?? "";
    const telegramInstanceId = telegramInstanceIdRaw.length > 0 ? telegramInstanceIdRaw : undefined;
    return {
        backendUrl,
        initData,
        telegramInstanceId
    };
}

/**
 * Extracts params from both query string and hash fragment of a URL/search string.
 * Hash params override query params when both are present.
 */
function paramsFromHref(href: string): URLSearchParams {
    try {
        const url = new URL(href, "https://placeholder");
        const merged = new URLSearchParams(url.search);
        // Parse hash fragment as additional params (Telegram puts params there).
        const hash = url.hash.startsWith("#") ? url.hash.slice(1) : url.hash;
        if (hash) {
            for (const [key, value] of new URLSearchParams(hash)) {
                if (!merged.has(key)) {
                    merged.set(key, value);
                }
            }
        }
        return merged;
    } catch {
        return new URLSearchParams(href);
    }
}

function backendUrlNormalize(value: string | null): string | null {
    const trimmed = value?.trim() ?? "";
    if (!trimmed) {
        return null;
    }

    try {
        const url = new URL(trimmed);
        const pathname = url.pathname.endsWith("/") ? url.pathname.slice(0, -1) : url.pathname;
        const normalizedPathname = pathname === "/" ? "" : pathname;
        return `${url.protocol}//${url.host}${normalizedPathname}`;
    } catch {
        return null;
    }
}
