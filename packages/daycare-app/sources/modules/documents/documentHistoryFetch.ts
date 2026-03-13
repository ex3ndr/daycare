import { apiUrl } from "../api/apiUrl";
import type { DocumentVersion } from "./documentsTypes";

/**
 * Fetches all versions of a document from the history endpoint.
 * Expects: baseUrl and token are valid; id is a valid document identifier.
 */
export async function documentHistoryFetch(
    baseUrl: string,
    token: string,
    workspaceId: string | null,
    id: string
): Promise<DocumentVersion[]> {
    const response = await fetch(apiUrl(baseUrl, `/documents/${encodeURIComponent(id)}/history`, workspaceId), {
        headers: { authorization: `Bearer ${token}` }
    });
    const data = (await response.json()) as { ok?: boolean; versions?: DocumentVersion[]; error?: string };
    if (data.ok !== true) {
        throw new Error(data.error ?? "Failed to fetch document history.");
    }
    return data.versions ?? [];
}
