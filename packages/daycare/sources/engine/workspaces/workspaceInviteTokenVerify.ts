import { jwtVerify } from "../../utils/jwt.js";
import { WORKSPACE_INVITE_JWT_SERVICE } from "./workspaceInviteTokenCreate.js";

/**
 * Verifies a workspace invite token and returns its workspace id.
 * Expects: token was created by workspaceInviteTokenCreate with the same secret.
 */
export async function workspaceInviteTokenVerify(token: string, secret: string): Promise<{ workspaceId: string }> {
    const normalizedToken = token.trim();
    if (!normalizedToken) {
        throw new Error("Invite token is required.");
    }

    const verified = await jwtVerify(normalizedToken, secret, {
        service: WORKSPACE_INVITE_JWT_SERVICE
    });

    try {
        const parsed = JSON.parse(Buffer.from(verified.userId, "base64url").toString("utf8")) as {
            workspaceId?: unknown;
            kind?: unknown;
        };
        const workspaceId = typeof parsed.workspaceId === "string" ? parsed.workspaceId.trim() : "";
        if (!workspaceId || parsed.kind !== "workspace-invite") {
            throw new Error("Invalid workspace invite token payload.");
        }
        return { workspaceId };
    } catch {
        throw new Error("Invalid workspace invite token payload.");
    }
}
