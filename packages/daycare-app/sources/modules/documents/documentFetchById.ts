import { apiUrl } from "../api/apiUrl";
import type { DocumentItem } from "./documentsTypes";

/**
 * Fetches a single vault entry by ID from the API.
 * Expects: baseUrl and token are valid (user is authenticated).
 */
export async function documentFetchById(
    baseUrl: string,
    token: string,
    workspaceId: string | null,
    id: string
): Promise<DocumentItem> {
    const response = await fetch(apiUrl(baseUrl, `/vault/${encodeURIComponent(id)}`, workspaceId), {
        headers: { authorization: `Bearer ${token}` }
    });
    const data = (await response.json()) as { ok?: boolean; item?: DocumentItem; error?: string };
    if (data.ok !== true || !data.item) {
        throw new Error(data.error ?? "Failed to fetch vault entry.");
    }
    return data.item;
}
