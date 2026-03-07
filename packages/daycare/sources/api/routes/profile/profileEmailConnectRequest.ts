import type { Context } from "@/types";

export type ProfileEmailConnectRequestInput = {
    ctx: Context;
    request: ((userId: string, email: string) => Promise<void>) | null;
    body: Record<string, unknown>;
};

export type ProfileEmailConnectRequestResult =
    | {
          ok: true;
      }
    | {
          ok: false;
          error: string;
      };

/**
 * Validates an authenticated email-connect request and triggers delivery of the confirmation link.
 * Expects: request is available when SMTP email linking is configured.
 */
export async function profileEmailConnectRequest(
    input: ProfileEmailConnectRequestInput
): Promise<ProfileEmailConnectRequestResult> {
    const email = typeof input.body.email === "string" ? input.body.email.trim() : "";
    if (!email) {
        return { ok: false, error: "Email is required." };
    }
    if (!input.request) {
        return { ok: false, error: "Email connection is unavailable." };
    }

    try {
        await input.request(input.ctx.userId, email);
        return { ok: true };
    } catch (error) {
        return {
            ok: false,
            error: error instanceof Error ? error.message : "Failed to send email connection link."
        };
    }
}
