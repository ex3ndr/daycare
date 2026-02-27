import { createHmac, timingSafeEqual } from "node:crypto";

export type AppTelegramInitDataValidationResult = {
    userId: string;
    authDateSeconds: number;
};

const APP_TELEGRAM_INIT_DATA_MAX_AGE_SECONDS = 86_400;
const APP_TELEGRAM_INIT_DATA_FUTURE_SKEW_SECONDS = 30;

/**
 * Validates Telegram WebApp initData and extracts the Telegram user id.
 * Expects: initData is a raw query-string payload and botToken is a valid Telegram bot token.
 */
export function appTelegramInitDataValidate(
    initData: string,
    botToken: string,
    nowMs: number = Date.now()
): AppTelegramInitDataValidationResult {
    const normalizedInitData = initData.trim();
    const normalizedBotToken = botToken.trim();
    if (!normalizedInitData) {
        throw new Error("Telegram initData is required.");
    }
    if (!normalizedBotToken) {
        throw new Error("Telegram bot token is required.");
    }

    const params = new URLSearchParams(normalizedInitData);
    const hash = params.get("hash")?.trim().toLowerCase();
    if (!hash) {
        throw new Error("Telegram initData hash is required.");
    }

    const dataCheckString = Array.from(params.entries())
        .filter(([key]) => key !== "hash")
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, value]) => `${key}=${value}`)
        .join("\n");

    const secretKey = createHmac("sha256", "WebAppData").update(normalizedBotToken).digest();
    const expectedHash = createHmac("sha256", secretKey).update(dataCheckString).digest("hex");
    if (!safeHexEqual(expectedHash, hash)) {
        throw new Error("Telegram initData signature is invalid.");
    }

    const authDateRaw = params.get("auth_date")?.trim() ?? "";
    const authDateSeconds = Number.parseInt(authDateRaw, 10);
    if (!Number.isInteger(authDateSeconds) || authDateSeconds < 1) {
        throw new Error("Telegram initData auth_date is invalid.");
    }

    const nowSeconds = Math.floor(nowMs / 1000);
    if (authDateSeconds > nowSeconds + APP_TELEGRAM_INIT_DATA_FUTURE_SKEW_SECONDS) {
        throw new Error("Telegram initData auth_date is in the future.");
    }
    if (nowSeconds - authDateSeconds > APP_TELEGRAM_INIT_DATA_MAX_AGE_SECONDS) {
        throw new Error("Telegram initData expired.");
    }

    const user = userPayloadParse(params.get("user"));
    if (!user) {
        throw new Error("Telegram initData user payload is invalid.");
    }

    return {
        userId: user,
        authDateSeconds
    };
}

function safeHexEqual(left: string, right: string): boolean {
    const leftBuffer = Buffer.from(left, "hex");
    const rightBuffer = Buffer.from(right, "hex");
    if (leftBuffer.length !== rightBuffer.length) {
        return false;
    }
    return timingSafeEqual(leftBuffer, rightBuffer);
}

function userPayloadParse(userRaw: string | null): string | null {
    if (!userRaw) {
        return null;
    }
    try {
        const parsed = JSON.parse(userRaw) as { id?: unknown };
        if (typeof parsed.id !== "string" && typeof parsed.id !== "number") {
            return null;
        }
        const userId = String(parsed.id).trim();
        return userId.length > 0 ? userId : null;
    } catch {
        return null;
    }
}
