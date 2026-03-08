import type { WorkspaceConfig } from "./configTypes";

/**
 * Updates workspace configuration flags via the profile endpoint.
 * Expects: baseUrl and token are valid.
 */
export async function configUpdate(
    baseUrl: string,
    token: string,
    configuration: Partial<WorkspaceConfig>
): Promise<void> {
    const response = await fetch(`${baseUrl}/profile/update`, {
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
