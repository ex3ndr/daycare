export type AuthValidateResult =
    | {
          ok: true;
          userId: string;
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
