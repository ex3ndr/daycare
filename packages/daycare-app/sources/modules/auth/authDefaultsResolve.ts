const DEFAULT_BACKEND_URL = "https://api.daycare.dev";
const DEFAULT_TELEGRAM_INSTANCE_ID = "telegram";

/**
 * Resolves auth defaults from Expo config with stable production fallbacks.
 * Expects: configured backend URL is absolute when provided; telegram instance id is non-empty when provided.
 */
export function authDefaultsResolve(): { backendUrl: string; telegramInstanceId: string } {
    const backendUrlValue = envValueResolve(
        "EXPO_PUBLIC_DAYCARE_DEFAULT_BACKEND_URL",
        "DAYCARE_APP_DEFAULT_BACKEND_URL"
    );
    let configuredBackendUrl: string | null = null;
    if (backendUrlValue !== null) {
        configuredBackendUrl = backendUrlNormalize(backendUrlValue);
    }
    const configuredTelegramInstanceId = (
        envValueResolve(
            "EXPO_PUBLIC_DAYCARE_DEFAULT_TELEGRAM_INSTANCE_ID",
            "DAYCARE_APP_DEFAULT_TELEGRAM_INSTANCE_ID"
        ) ?? ""
    ).trim();

    return {
        backendUrl: configuredBackendUrl ?? DEFAULT_BACKEND_URL,
        telegramInstanceId: configuredTelegramInstanceId || DEFAULT_TELEGRAM_INSTANCE_ID
    };
}

function backendUrlNormalize(value: string): string | null {
    const trimmed = value.trim();
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

function envValueResolve(...keys: string[]): string | null {
    for (const key of keys) {
        const value = process.env[key];
        if (typeof value === "string" && value.trim().length > 0) {
            return value;
        }
    }
    return null;
}
