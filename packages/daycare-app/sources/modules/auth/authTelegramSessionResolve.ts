import { authTelegramExchange } from "@/modules/auth/authApi";
import type { AuthSession } from "@/modules/auth/authStoreCreate";
import { authTelegramWebAppContextParse } from "@/modules/auth/authTelegramWebAppContextParse";

type TelegramWindow = Window & {
    Telegram?: {
        WebApp?: {
            initData?: string;
            ready?: () => void;
        };
    };
};

/**
 * Resolves a Telegram WebApp session from the current browser page.
 * Expects: Telegram WebApp initData and `backend` query param are present in the active URL.
 */
export async function authTelegramSessionResolve(): Promise<AuthSession | null> {
    if (typeof window === "undefined") {
        return null;
    }

    const telegramWindow = window as TelegramWindow;
    const telegramContext = authTelegramWebAppContextParse(
        window.location.search,
        telegramWindow.Telegram?.WebApp?.initData
    );
    if (!telegramContext) {
        return null;
    }

    telegramWindow.Telegram?.WebApp?.ready?.();
    const result = await authTelegramExchange(
        telegramContext.backendUrl,
        telegramContext.initData,
        telegramContext.telegramInstanceId
    );
    if (!result.ok) {
        return null;
    }

    return {
        baseUrl: telegramContext.backendUrl,
        token: result.token
    };
}
