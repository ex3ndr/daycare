import { apiUrl } from "../api/apiUrl";
import type { DocumentItem } from "./documentsTypes";

/**
 * Fetches all vault entries as a flat array with parentId from the tree endpoint.
 * Expects: baseUrl and token are valid (user is authenticated).
 */
export async function documentsFetch(
    baseUrl: string,
    token: string,
    workspaceId: string | null
): Promise<DocumentItem[]> {
    const response = await fetch(apiUrl(baseUrl, "/vault/tree", workspaceId), {
        headers: { authorization: `Bearer ${token}` }
    });
    const data = (await response.json()) as { ok?: boolean; items?: DocumentItem[]; error?: string };
    if (data.ok !== true) {
        throw new Error(data.error ?? "Failed to fetch vault entries.");
    }
    return data.items ?? [];
}
