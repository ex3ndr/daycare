export type AuthTelegramWebAppContext = {
    backendUrl: string;
    initData: string;
    telegramInstanceId?: string;
};

/**
 * Parses Telegram WebApp auth context from URL search params and initData.
 * Expects: search contains backend URL in `backend` query param and initData is the raw Telegram WebApp payload.
 */
export function authTelegramWebAppContextParse(
    search: string,
    initDataRaw: string | null | undefined
): AuthTelegramWebAppContext | null {
    const initData = initDataRaw?.trim() ?? "";
    if (!initData) {
        return null;
    }

    const params = new URLSearchParams(search);
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
