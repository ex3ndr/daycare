import { apiUrl } from "../api/apiUrl";

/**
 * Deletes a named secret.
 * Expects: baseUrl and token are valid; name refers to an existing secret.
 */
export async function secretDelete(
    baseUrl: string,
    token: string,
    workspaceNametag: string | null,
    name: string
): Promise<void> {
    const response = await fetch(apiUrl(baseUrl, `/secrets/${encodeURIComponent(name)}/delete`, workspaceNametag), {
        method: "POST",
        headers: { authorization: `Bearer ${token}` }
    });
    const data = (await response.json()) as { ok?: boolean; error?: string };
    if (data.ok !== true) {
        throw new Error(data.error ?? "Failed to delete secret.");
    }
}
