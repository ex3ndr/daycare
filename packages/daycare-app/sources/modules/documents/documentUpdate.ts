import { apiUrl } from "../api/apiUrl";
import type { DocumentItem } from "./documentsTypes";

/**
 * Updates a vault entry via the API.
 * Expects: baseUrl and token are valid; id is a valid vault identifier.
 */
export async function documentUpdate(
    baseUrl: string,
    token: string,
    workspaceId: string | null,
    id: string,
    input: { slug?: string; title?: string; description?: string; body?: string; parentId?: string | null }
): Promise<DocumentItem> {
    const response = await fetch(apiUrl(baseUrl, `/vault/${encodeURIComponent(id)}/update`, workspaceId), {
        method: "POST",
        headers: {
            authorization: `Bearer ${token}`,
            "content-type": "application/json"
        },
        body: JSON.stringify(input)
    });
    const data = (await response.json()) as { ok?: boolean; item?: DocumentItem; error?: string };
    if (data.ok !== true || !data.item) {
        throw new Error(data.error ?? "Failed to update vault entry.");
    }
    return data.item;
}
