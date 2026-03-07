export type AuthValidateResult =
    | {
          ok: true;
          userId: string;
          token?: string;
      }
    | {
          ok: false;
          error: string;
      };

export type AuthTokenExchangeResult =
    | {
          ok: true;
          userId: string;
          token: string;
      }
    | {
          ok: false;
          error: string;
      };

export type AuthEmailRequestResult =
    | {
          ok: true;
      }
    | {
          ok: false;
          error: string;
      };

export type AuthEmailConnectVerifyResult =
    | {
          ok: true;
          userId: string;
          email: string;
      }
    | {
          ok: false;
          error: string;
      };

/**
 * Validates an auth token and exchanges link tokens to session tokens when needed.
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
        token?: string;
        error?: string;
    };

    if (payload.ok === true && typeof payload.userId === "string") {
        const exchangedToken = typeof payload.token === "string" ? payload.token : undefined;
        return {
            ok: true,
            userId: payload.userId,
            ...(exchangedToken ? { token: exchangedToken } : {})
        };
    }

    return {
        ok: false,
        error: typeof payload.error === "string" ? payload.error : "Token validation failed"
    };
}

/**
 * Exchanges Telegram WebApp initData for an app session token.
 * Expects: baseUrl points to daycare-app-server and initData is raw Telegram initData string.
 */
export async function authTelegramExchange(
    baseUrl: string,
    initData: string,
    telegramInstanceId?: string
): Promise<AuthTokenExchangeResult> {
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

/**
 * Requests a Better Auth magic link email for the provided address.
 * Expects: baseUrl points to daycare-app-server and email is non-empty.
 */
export async function authEmailRequest(baseUrl: string, email: string): Promise<AuthEmailRequestResult> {
    const response = await fetch(`${baseUrl}/auth/email/request`, {
        method: "POST",
        headers: {
            "content-type": "application/json"
        },
        body: JSON.stringify({ email })
    });

    const parsed = (await response.json()) as {
        ok?: boolean;
        error?: string;
    };

    if (parsed.ok === true) {
        return { ok: true };
    }

    return {
        ok: false,
        error: typeof parsed.error === "string" ? parsed.error : "Failed to send sign-in email."
    };
}

/**
 * Verifies an email magic-link token and exchanges it for a Daycare app session token.
 * Expects: baseUrl points to daycare-app-server and token is non-empty.
 */
export async function authEmailVerify(baseUrl: string, token: string): Promise<AuthTokenExchangeResult> {
    const response = await fetch(`${baseUrl}/auth/email/verify`, {
        method: "POST",
        headers: {
            "content-type": "application/json"
        },
        body: JSON.stringify({ token })
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
        error: typeof parsed.error === "string" ? parsed.error : "Magic link verification failed."
    };
}

/**
 * Verifies an email-connect link and links the address to the target Daycare account.
 * Expects: baseUrl points to daycare-app-server and token is non-empty.
 */
export async function authEmailConnectVerify(baseUrl: string, token: string): Promise<AuthEmailConnectVerifyResult> {
    const response = await fetch(`${baseUrl}/auth/email/connect/verify`, {
        method: "POST",
        headers: {
            "content-type": "application/json"
        },
        body: JSON.stringify({ token })
    });

    const parsed = (await response.json()) as {
        ok?: boolean;
        userId?: string;
        email?: string;
        error?: string;
    };

    if (parsed.ok === true && typeof parsed.userId === "string" && typeof parsed.email === "string") {
        return {
            ok: true,
            userId: parsed.userId,
            email: parsed.email
        };
    }

    return {
        ok: false,
        error: typeof parsed.error === "string" ? parsed.error : "Email connection verification failed."
    };
}
