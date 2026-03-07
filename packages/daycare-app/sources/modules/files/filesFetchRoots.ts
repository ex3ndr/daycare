import { apiUrl } from "../api/apiUrl";
import type { FileRoot } from "./filesTypes";

/**
 * Fetches the list of base directory roots.
 * Expects: baseUrl and token are valid.
 */
export async function filesFetchRoots(baseUrl: string, token: string, workspaceId: string | null): Promise<FileRoot[]> {
    const response = await fetch(apiUrl(baseUrl, "/files/roots", workspaceId), {
        headers: { authorization: `Bearer ${token}` }
    });
    const data = (await response.json()) as { ok?: boolean; roots?: FileRoot[]; error?: string };
    if (data.ok !== true) {
        throw new Error(data.error ?? "Failed to fetch file roots.");
    }
    return data.roots ?? [];
}
