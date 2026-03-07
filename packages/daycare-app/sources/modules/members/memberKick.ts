import type { MemberKickResult } from "./membersTypes";

/**
 * Removes a workspace member with an optional reason string.
 * Expects: authenticated caller owns the target workspace.
 */
export async function memberKick(
    baseUrl: string,
    token: string,
    nametag: string,
    userId: string,
    reason: string
): Promise<MemberKickResult> {
    const response = await fetch(
        `${baseUrl}/workspaces/${encodeURIComponent(nametag)}/members/${encodeURIComponent(userId)}/kick`,
        {
            method: "POST",
            headers: {
                authorization: `Bearer ${token}`,
                "content-type": "application/json"
            },
            body: JSON.stringify({ reason })
        }
    );

    const payload = (await response.json()) as MemberKickResult;
    if (payload.ok === true) {
        return payload;
    }
    return {
        ok: false,
        error: payload.error || "Failed to remove member."
    };
}
