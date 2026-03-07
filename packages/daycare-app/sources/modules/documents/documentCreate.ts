import { apiUrl } from "../api/apiUrl";
import type { DocumentItem } from "./documentsTypes";

/**
 * Creates a new document via the API.
 * Expects: baseUrl and token are valid; input has required fields.
 */
export async function documentCreate(
    baseUrl: string,
    token: string,
    workspaceId: string | null,
    input: { id: string; slug: string; title: string; description?: string; body?: string; parentId: string }
): Promise<DocumentItem> {
    const response = await fetch(apiUrl(baseUrl, "/documents", workspaceId), {
        method: "POST",
        headers: {
            authorization: `Bearer ${token}`,
            "content-type": "application/json"
        },
        body: JSON.stringify(input)
    });
    const data = (await response.json()) as { ok?: boolean; document?: DocumentItem; error?: string };
    if (data.ok !== true || !data.document) {
        throw new Error(data.error ?? "Failed to create document.");
    }
    return data.document;
}
