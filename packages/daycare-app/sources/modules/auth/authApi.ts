export type AuthValidateResult =
    | {
          ok: true;
          userId: string;
      }
    | {
          ok: false;
          error: string;
      };

export type AuthTelegramExchangeResult =
    | {
          ok: true;
          userId: string;
          token: string;
      }
    | {
          ok: false;
          error: string;
      };

/**
 * Validates a magic link token with the Daycare app server.
 * Expects: baseUrl points to daycare-app-server and token is non-empty.
 */
export async function authValidateToken(baseUrl: string, token: string): Promise<AuthValidateResult> {
    const response = await fetch(`${baseUrl}/auth/validate`, {
        method: "POST",
        headers: {
            "content-type": "application/json"
        },
        body: JSON.stringify({ token })
    });

    const payload = (await response.json()) as {
        ok?: boolean;
        userId?: string;
        error?: string;
    };

    if (payload.ok === true && typeof payload.userId === "string") {
        return { ok: true, userId: payload.userId };
    }

    return {
        ok: false,
        error: typeof payload.error === "string" ? payload.error : "Token validation failed"
    };
}

/**
 * Exchanges Telegram WebApp initData for a short-lived app token.
 * Expects: baseUrl points to daycare-app-server and initData is raw Telegram initData string.
 */
export async function authTelegramExchange(
    baseUrl: string,
    initData: string,
    telegramInstanceId?: string
): Promise<AuthTelegramExchangeResult> {
    const payload: {
        initData: string;
        telegramInstanceId?: string;
    } = {
        initData
    };
    const normalizedTelegramInstanceId = telegramInstanceId?.trim();
    if (normalizedTelegramInstanceId) {
        payload.telegramInstanceId = normalizedTelegramInstanceId;
    }

    const response = await fetch(`${baseUrl}/auth/telegram`, {
        method: "POST",
        headers: {
            "content-type": "application/json"
        },
        body: JSON.stringify(payload)
    });

    const parsed = (await response.json()) as {
        ok?: boolean;
        userId?: string;
        token?: string;
        error?: string;
    };

    if (parsed.ok === true && typeof parsed.userId === "string" && typeof parsed.token === "string") {
        return {
            ok: true,
            userId: parsed.userId,
            token: parsed.token
        };
    }

    return {
        ok: false,
        error: typeof parsed.error === "string" ? parsed.error : "Telegram authentication failed."
    };
}
