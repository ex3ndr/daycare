import { jwtSign } from "../../utils/jwt.js";

export const WORKSPACE_INVITE_EXPIRES_IN_SECONDS = 10 * 60;
export const WORKSPACE_INVITE_JWT_SERVICE = "daycare.workspace-invite";

type WorkspaceInviteTokenPayload = {
    workspaceId: string;
    kind: "workspace-invite";
};

export type WorkspaceInviteTokenCreateInput = {
    workspaceId: string;
    secret: string;
    expiresInSeconds?: number;
};

/**
 * Creates a short-lived workspace invite token.
 * Expects: workspaceId is non-empty and secret is the active app JWT seed.
 */
export async function workspaceInviteTokenCreate(
    input: WorkspaceInviteTokenCreateInput
): Promise<{ token: string; expiresAt: number }> {
    const workspaceId = input.workspaceId.trim();
    if (!workspaceId) {
        throw new Error("workspaceId is required.");
    }

    const expiresInSeconds = input.expiresInSeconds ?? WORKSPACE_INVITE_EXPIRES_IN_SECONDS;
    const token = await jwtSign(
        {
            userId: Buffer.from(
                JSON.stringify({
                    workspaceId,
                    kind: "workspace-invite"
                } satisfies WorkspaceInviteTokenPayload),
                "utf8"
            ).toString("base64url")
        },
        input.secret,
        expiresInSeconds,
        {
            service: WORKSPACE_INVITE_JWT_SERVICE
        }
    );

    return {
        token,
        expiresAt: Date.now() + expiresInSeconds * 1000
    };
}
