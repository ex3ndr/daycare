import { apiUrl } from "../api/apiUrl";
import type { VaultItem } from "./vaultsTypes";

/**
 * Creates a new vault entry via the API.
 * Expects: baseUrl and token are valid; input has required fields.
 */
export async function vaultCreate(
    baseUrl: string,
    token: string,
    workspaceId: string | null,
    input: { id: string; slug: string; title: string; description?: string; body?: string; parentId: string }
): Promise<VaultItem> {
    const response = await fetch(apiUrl(baseUrl, "/vault/create", workspaceId), {
        method: "POST",
        headers: {
            authorization: `Bearer ${token}`,
            "content-type": "application/json"
        },
        body: JSON.stringify(input)
    });
    const data = (await response.json()) as { ok?: boolean; item?: VaultItem; error?: string };
    if (data.ok !== true || !data.item) {
        throw new Error(data.error ?? "Failed to create vault entry.");
    }
    return data.item;
}
