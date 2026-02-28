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

const TELEGRAM_INIT_DATA_WAIT_TIMEOUT_MS = 1500;
const TELEGRAM_INIT_DATA_WAIT_STEP_MS = 50;

/**
 * Resolves a Telegram WebApp session from the current browser page.
 * Expects: Telegram WebApp initData and `backend` query param are present in the active URL.
 */
export async function authTelegramSessionResolve(): Promise<AuthSession | null> {
    if (typeof window === "undefined") {
        return null;
    }

    const telegramWindow = window as TelegramWindow;
    const telegramContextBase = authTelegramWebAppContextParse(window.location.search, "__pending__");
    if (!telegramContextBase) {
        return null;
    }
    const initData = await telegramInitDataResolve(telegramWindow);
    if (!initData) {
        return null;
    }
    const telegramContext = authTelegramWebAppContextParse(
        window.location.search,
        initData
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

async function telegramInitDataResolve(telegramWindow: TelegramWindow): Promise<string | null> {
    const deadline = Date.now() + TELEGRAM_INIT_DATA_WAIT_TIMEOUT_MS;
    while (Date.now() <= deadline) {
        const initData = telegramWindow.Telegram?.WebApp?.initData?.trim() ?? "";
        if (initData.length > 0) {
            return initData;
        }
        await new Promise<void>((resolve) => {
            setTimeout(resolve, TELEGRAM_INIT_DATA_WAIT_STEP_MS);
        });
    }
    return null;
}
