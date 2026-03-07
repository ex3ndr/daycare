export type ProfileEmailConnectRequestResult =
    | {
          ok: true;
      }
    | {
          ok: false;
          error: string;
      };

/**
 * Requests an authenticated email connection link for the current user.
 * Expects: baseUrl and token are valid and email is non-empty.
 */
export async function profileEmailConnectRequest(
    baseUrl: string,
    token: string,
    email: string
): Promise<ProfileEmailConnectRequestResult> {
    const response = await fetch(`${baseUrl}/profile/email/connect/request`, {
        method: "POST",
        headers: {
            authorization: `Bearer ${token}`,
            "content-type": "application/json"
        },
        body: JSON.stringify({ email })
    });

    const data = (await response.json()) as { ok?: boolean; error?: string };
    if (data.ok === true) {
        return { ok: true };
    }

    return {
        ok: false,
        error: typeof data.error === "string" ? data.error : "Failed to send email connection link."
    };
}
