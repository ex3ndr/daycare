import type { MembersInviteCreateResult } from "./membersTypes";

/**
 * Creates a reusable workspace invite link for an owner.
 * Expects: nametag identifies an owner-managed workspace.
 */
export async function membersInviteCreate(
    baseUrl: string,
    token: string,
    nametag: string
): Promise<MembersInviteCreateResult> {
    const response = await fetch(`${baseUrl}/workspaces/${encodeURIComponent(nametag)}/invite/create`, {
        method: "POST",
        headers: {
            authorization: `Bearer ${token}`,
            "content-type": "application/json"
        },
        body: JSON.stringify({})
    });

    const payload = (await response.json()) as MembersInviteCreateResult;
    if (payload.ok === true) {
        return payload;
    }
    return {
        ok: false,
        error: payload.error || "Failed to create invite link."
    };
}
