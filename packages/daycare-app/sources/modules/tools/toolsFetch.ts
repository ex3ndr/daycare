import { apiUrl } from "../api/apiUrl";
import type { ToolListItem } from "./toolsTypes";

/**
 * Fetches the list of tools from the app-server.
 * Expects: baseUrl and token are valid (user is authenticated).
 */
export async function toolsFetch(baseUrl: string, token: string, workspaceId: string | null): Promise<ToolListItem[]> {
    const response = await fetch(apiUrl(baseUrl, "/tools", workspaceId), {
        headers: { authorization: `Bearer ${token}` }
    });
    const data = (await response.json()) as { ok?: boolean; tools?: ToolListItem[]; error?: string };
    if (data.ok !== true) {
        throw new Error(data.error ?? "Failed to fetch tools");
    }
    return data.tools ?? [];
}
