export type AuthTelegramWebAppContext = {
    backendUrl: string;
    initData: string;
    telegramInstanceId?: string;
};

/**
 * Parses Telegram WebApp auth context from URL and initData.
 * Checks both query params and hash fragment, since Telegram may move params to the hash.
 * Expects: backend URL in `backend` param and initData is the raw Telegram WebApp payload.
 */
export function authTelegramWebAppContextParse(
    href: string,
    initDataRaw: string | null | undefined
): AuthTelegramWebAppContext | null {
    const initData = initDataRaw?.trim() ?? "";
    if (!initData) {
        return null;
    }

    // Try query params first, then hash fragment (Telegram may put params in either).
    const params = paramsFromHref(href);
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
