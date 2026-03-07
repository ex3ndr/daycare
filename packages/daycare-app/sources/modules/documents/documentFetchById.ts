import { apiUrl } from "../api/apiUrl";
import type { DocumentItem } from "./documentsTypes";

/**
 * Fetches a single document by ID from the API.
 * Expects: baseUrl and token are valid (user is authenticated).
 */
export async function documentFetchById(
    baseUrl: string,
    token: string,
    workspaceNametag: string | null,
    id: string
): Promise<DocumentItem> {
    const response = await fetch(apiUrl(baseUrl, `/documents/${encodeURIComponent(id)}`, workspaceNametag), {
        headers: { authorization: `Bearer ${token}` }
    });
    const data = (await response.json()) as { ok?: boolean; document?: DocumentItem; error?: string };
    if (data.ok !== true || !data.document) {
        throw new Error(data.error ?? "Failed to fetch document.");
    }
    return data.document;
}
