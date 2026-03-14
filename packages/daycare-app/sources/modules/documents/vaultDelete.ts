import { apiUrl } from "../api/apiUrl";

/**
 * Deletes a vault entry via the API (soft-delete).
 * Expects: baseUrl and token are valid; id is a valid vault identifier.
 */
export async function vaultDelete(
    baseUrl: string,
    token: string,
    workspaceId: string | null,
    id: string
): Promise<void> {
    const response = await fetch(apiUrl(baseUrl, `/vault/${encodeURIComponent(id)}/delete`, workspaceId), {
        method: "POST",
        headers: { authorization: `Bearer ${token}` }
    });
    const data = (await response.json()) as { ok?: boolean; error?: string };
    if (data.ok !== true) {
        throw new Error(data.error ?? "Failed to delete vault entry.");
    }
}
