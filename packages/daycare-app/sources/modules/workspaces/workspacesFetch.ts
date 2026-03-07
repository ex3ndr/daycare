export type WorkspaceListItem = {
    nametag: string;
    userId: string;
    firstName: string | null;
    lastName: string | null;
    isSelf: boolean;
};

/**
 * Fetches the list of workspaces accessible to the authenticated user.
 * Expects: baseUrl and token are valid (user is authenticated).
 */
export async function workspacesFetch(baseUrl: string, token: string): Promise<WorkspaceListItem[]> {
    const response = await fetch(`${baseUrl}/workspaces`, {
        headers: { authorization: `Bearer ${token}` }
    });
    if (!response.ok) {
        throw new Error(`Failed to fetch workspaces: ${response.status}`);
    }
    const data = (await response.json()) as { ok?: boolean; workspaces?: WorkspaceListItem[] };
    return data.workspaces ?? [];
}
