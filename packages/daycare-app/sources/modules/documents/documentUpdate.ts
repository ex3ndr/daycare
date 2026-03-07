import { apiUrl } from "../api/apiUrl";
import type { DocumentItem } from "./documentsTypes";

/**
 * Updates a document via the API.
 * Expects: baseUrl and token are valid; id is a valid document identifier.
 */
export async function documentUpdate(
    baseUrl: string,
    token: string,
    workspaceNametag: string | null,
    id: string,
    input: { slug?: string; title?: string; description?: string; body?: string; parentId?: string | null }
): Promise<DocumentItem> {
    const response = await fetch(apiUrl(baseUrl, `/documents/${encodeURIComponent(id)}`, workspaceNametag), {
        method: "PUT",
        headers: {
            authorization: `Bearer ${token}`,
            "content-type": "application/json"
        },
        body: JSON.stringify(input)
    });
    const data = (await response.json()) as { ok?: boolean; document?: DocumentItem; error?: string };
    if (data.ok !== true || !data.document) {
        throw new Error(data.error ?? "Failed to update document.");
    }
    return data.document;
}
