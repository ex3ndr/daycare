import { apiUrl } from "../api/apiUrl";
import type { WorkspaceConfig } from "./configTypes";

/**
 * Fetches the workspace configuration flags from the server.
 * Expects: baseUrl, token, and workspaceId are valid.
 */
export async function configFetch(baseUrl: string, token: string, workspaceId: string): Promise<WorkspaceConfig> {
    const response = await fetch(apiUrl(baseUrl, "/config", workspaceId), {
        headers: { authorization: `Bearer ${token}` }
    });
    const data = (await response.json()) as { ok?: boolean; configuration?: WorkspaceConfig; error?: string };
    if (data.ok !== true) {
        throw new Error(data.error ?? "Failed to fetch config");
    }
    if (!data.configuration) {
        throw new Error("Configuration data missing from response");
    }
    return data.configuration;
}
