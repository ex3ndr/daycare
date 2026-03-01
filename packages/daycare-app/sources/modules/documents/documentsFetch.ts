import type { DocumentItem } from "./documentsTypes";

/**
 * Fetches all documents as a flat array with parentId from the tree endpoint.
 * Expects: baseUrl and token are valid (user is authenticated).
 */
export async function documentsFetch(baseUrl: string, token: string): Promise<DocumentItem[]> {
    const response = await fetch(`${baseUrl}/documents/tree`, {
        headers: { authorization: `Bearer ${token}` }
    });
    const data = (await response.json()) as { ok?: boolean; items?: DocumentItem[]; error?: string };
    if (data.ok !== true) {
        throw new Error(data.error ?? "Failed to fetch documents.");
    }
    return data.items ?? [];
}
