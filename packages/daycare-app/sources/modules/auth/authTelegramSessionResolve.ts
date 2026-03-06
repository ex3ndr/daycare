import { authTelegramExchange } from "@/modules/auth/authApi";
import type { AuthSession } from "@/modules/auth/authStoreCreate";
import { authTelegramWebAppContextParse } from "@/modules/auth/authTelegramWebAppContextParse";
import { isTMA } from "@/modules/tma/isTMA";
import { tmaInitData } from "@/modules/tma/tmaInitData";
import { tmaLaunchParams } from "@/modules/tma/tmaLaunchParams";
import { tmaReady } from "@/modules/tma/tmaReady";

/**
 * Resolves a Telegram WebApp session from the current browser page.
 * Uses @tma.js/bridge to detect TMA environment and retrieve initData.
 * Expects: Telegram WebApp initData is available when inside TMA.
 */
export async function authTelegramSessionResolve(): Promise<AuthSession | null> {
    if (typeof window === "undefined") {
        console.info("[daycare-app] tma-auth: skipped (no window)");
        return null;
    }

    if (!isTMA()) {
        console.info("[daycare-app] tma-auth: skipped (not TMA environment)");
        return null;
    }

    console.info("[daycare-app] tma-auth: TMA environment detected");

    const initData = tmaInitData();
    console.info(`[daycare-app] tma-auth: initData=${initData ? `present (${initData.length} chars)` : "missing"}`);
    if (!initData) {
        console.warn("[daycare-app] tma-auth: failed - no initData available");
        return null;
    }

    const rawLaunchParams = tmaLaunchParams();
    console.info(
        `[daycare-app] tma-auth: rawLaunchParams=${rawLaunchParams ? `present (${rawLaunchParams.length} chars)` : "missing"}`
    );
    const telegramContext = authTelegramWebAppContextParse(window.location.href, initData, rawLaunchParams);
    console.info(
        `[daycare-app] tma-auth: context=${telegramContext ? "parsed" : "failed"} href=${window.location.href}`
    );
    if (!telegramContext) {
        console.warn("[daycare-app] tma-auth: failed - invalid auth context");
        return null;
    }

    tmaReady();
    console.info(
        `[daycare-app] tma-auth: exchanging token with backend=${telegramContext.backendUrl}` +
            (telegramContext.telegramInstanceId ? ` instanceId=${telegramContext.telegramInstanceId}` : "")
    );

    try {
        const result = await authTelegramExchange(
            telegramContext.backendUrl,
            telegramContext.initData,
            telegramContext.telegramInstanceId
        );
        if (!result.ok) {
            console.warn(`[daycare-app] tma-auth: exchange failed - ${result.error}`);
            return null;
        }

        console.info(`[daycare-app] tma-auth: exchange succeeded userId=${result.userId}`);
        return {
            baseUrl: telegramContext.backendUrl,
            token: result.token
        };
    } catch (e) {
        console.warn(`[daycare-app] tma-auth: exchange error - ${e instanceof Error ? e.message : String(e)}`);
        return null;
    }
}
