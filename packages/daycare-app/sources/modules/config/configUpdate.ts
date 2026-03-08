import { apiUrl } from "../api/apiUrl";
import type { WorkspaceConfig } from "./configTypes";

/**
 * Updates workspace configuration flags via the workspace-scoped profile endpoint.
 * Expects: baseUrl, token, and workspaceId are valid.
 */
export async function configUpdate(
    baseUrl: string,
    token: string,
    workspaceId: string,
    configuration: Partial<WorkspaceConfig>
): Promise<void> {
    const response = await fetch(apiUrl(baseUrl, "/profile/update", workspaceId), {
        method: "POST",
        headers: {
            authorization: `Bearer ${token}`,
            "content-type": "application/json"
        },
        body: JSON.stringify({ configuration })
    });
    const data = (await response.json()) as { ok?: boolean; error?: string };
    if (data.ok !== true) {
        throw new Error(data.error ?? "Failed to update configuration");
    }
}
