import { apiUrl } from "../api/apiUrl";
import type { VaultItem } from "./vaultsTypes";

/**
 * Fetches all vault entries as a flat array with parentId from the tree endpoint.
 * Expects: baseUrl and token are valid (user is authenticated).
 */
export async function vaultsFetch(baseUrl: string, token: string, workspaceId: string | null): Promise<VaultItem[]> {
    const response = await fetch(apiUrl(baseUrl, "/vault/tree", workspaceId), {
        headers: { authorization: `Bearer ${token}` }
    });
    const data = (await response.json()) as { ok?: boolean; items?: VaultItem[]; error?: string };
    if (data.ok !== true) {
        throw new Error(data.error ?? "Failed to fetch vault entries.");
    }
    return data.items ?? [];
}
