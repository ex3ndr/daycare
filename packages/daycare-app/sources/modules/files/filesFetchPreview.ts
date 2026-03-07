import { apiUrl } from "../api/apiUrl";
import type { FilePreview } from "./filesTypes";

/**
 * Fetches file content for preview.
 * Expects: baseUrl and token are valid; filePath is a relative path.
 */
export async function filesFetchPreview(
    baseUrl: string,
    token: string,
    workspaceId: string | null,
    filePath: string
): Promise<FilePreview> {
    const url = `${apiUrl(baseUrl, "/files/read", workspaceId)}?path=${encodeURIComponent(filePath)}`;
    const response = await fetch(url, {
        headers: { authorization: `Bearer ${token}` }
    });
    const data = (await response.json()) as FilePreview & { ok?: boolean; error?: string };
    if (data.ok !== true) {
        throw new Error(data.error ?? "Failed to read file.");
    }
    return data;
}
