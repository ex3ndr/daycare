import { apiUrl } from "../api/apiUrl";
import type { FileEntry } from "./filesTypes";

/**
 * Fetches directory contents for a given path.
 * Expects: baseUrl and token are valid; dirPath is a relative path.
 */
export async function filesFetchDir(
    baseUrl: string,
    token: string,
    workspaceId: string | null,
    dirPath: string
): Promise<FileEntry[]> {
    const url = `${apiUrl(baseUrl, "/files/list", workspaceId)}?path=${encodeURIComponent(dirPath)}`;
    const response = await fetch(url, {
        headers: { authorization: `Bearer ${token}` }
    });
    const data = (await response.json()) as { ok?: boolean; entries?: FileEntry[]; error?: string };
    if (data.ok !== true) {
        throw new Error(data.error ?? "Failed to list directory.");
    }
    return data.entries ?? [];
}
