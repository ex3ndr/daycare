import type { MemberItem } from "./membersTypes";

/**
 * Fetches the active member list for a workspace.
 * Expects: nametag identifies a workspace visible to the authenticated caller.
 */
export async function membersFetch(baseUrl: string, token: string, nametag: string): Promise<MemberItem[]> {
    const response = await fetch(`${baseUrl}/workspaces/${encodeURIComponent(nametag)}/members`, {
        headers: {
            authorization: `Bearer ${token}`
        }
    });

    if (!response.ok) {
        const payload = (await response.json().catch(() => null)) as { error?: unknown } | null;
        throw new Error(
            typeof payload?.error === "string" ? payload.error : `Failed to fetch members: ${response.status}`
        );
    }

    const payload = (await response.json()) as { members?: MemberItem[] };
    return payload.members ?? [];
}
