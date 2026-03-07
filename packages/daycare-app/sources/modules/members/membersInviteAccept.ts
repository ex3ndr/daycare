import type { MembersInviteAcceptResult } from "./membersTypes";

/**
 * Accepts a workspace invite token for the authenticated caller.
 * Expects: token is a workspace invite hash payload token from the current server.
 */
export async function membersInviteAccept(
    baseUrl: string,
    token: string,
    inviteToken: string
): Promise<MembersInviteAcceptResult> {
    const response = await fetch(`${baseUrl}/invite/accept`, {
        method: "POST",
        headers: {
            authorization: `Bearer ${token}`,
            "content-type": "application/json"
        },
        body: JSON.stringify({ token: inviteToken })
    });

    const payload = (await response.json()) as MembersInviteAcceptResult;
    if (payload.ok === true) {
        return payload;
    }
    return {
        ok: false,
        error: payload.error || "Failed to accept workspace invite."
    };
}
