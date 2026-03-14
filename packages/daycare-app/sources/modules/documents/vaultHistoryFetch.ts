import { apiUrl } from "../api/apiUrl";
import type { VaultVersion } from "./vaultsTypes";

/**
 * Fetches all versions of a vault entry from the history endpoint.
 * Expects: baseUrl and token are valid; id is a valid vault identifier.
 */
export async function vaultHistoryFetch(
    baseUrl: string,
    token: string,
    workspaceId: string | null,
    id: string
): Promise<VaultVersion[]> {
    const response = await fetch(apiUrl(baseUrl, `/vault/${encodeURIComponent(id)}/history`, workspaceId), {
        headers: { authorization: `Bearer ${token}` }
    });
    const data = (await response.json()) as { ok?: boolean; versions?: VaultVersion[]; error?: string };
    if (data.ok !== true) {
        throw new Error(data.error ?? "Failed to fetch vault history.");
    }
    return data.versions ?? [];
}
