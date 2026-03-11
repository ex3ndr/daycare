import { apiUrl } from "@/modules/api/apiUrl";
import type { MiniAppListItem } from "./miniAppsTypes";

/**
 * Fetches mini apps for one workspace.
 * Expects: baseUrl and token are valid app-session credentials.
 */
export async function miniAppsFetch(baseUrl: string, token: string, workspaceId: string): Promise<MiniAppListItem[]> {
    const response = await fetch(apiUrl(baseUrl, "/mini-apps", workspaceId), {
        headers: { authorization: `Bearer ${token}` }
    });
    if (!response.ok) {
        throw new Error(`Failed to fetch mini apps: ${response.status}`);
    }
    const data = (await response.json()) as { ok?: boolean; apps?: MiniAppListItem[] };
    return data.apps ?? [];
}
