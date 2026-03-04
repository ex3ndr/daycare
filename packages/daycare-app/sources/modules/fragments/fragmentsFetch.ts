import type { FragmentListItem } from "./fragmentsTypes";

/**
 * Fetches the list of active fragments from the app-server.
 * Expects: baseUrl and token are valid (user is authenticated).
 */
export async function fragmentsFetch(baseUrl: string, token: string): Promise<FragmentListItem[]> {
    const response = await fetch(`${baseUrl}/fragments`, {
        headers: { authorization: `Bearer ${token}` }
    });
    const data = (await response.json()) as { ok?: boolean; fragments?: FragmentListItem[]; error?: string };
    if (data.ok !== true) {
        throw new Error(data.error ?? "Failed to fetch fragments");
    }
    return data.fragments ?? [];
}
