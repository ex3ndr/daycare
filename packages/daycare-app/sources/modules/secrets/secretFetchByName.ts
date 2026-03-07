import { apiUrl } from "../api/apiUrl";
import type { SecretSummary } from "./secretsTypes";

/**
 * Fetches one secret summary by name.
 * Expects: baseUrl and token are valid.
 */
export async function secretFetchByName(
    baseUrl: string,
    token: string,
    workspaceId: string | null,
    name: string
): Promise<SecretSummary> {
    const response = await fetch(apiUrl(baseUrl, `/secrets/${encodeURIComponent(name)}`, workspaceId), {
        headers: { authorization: `Bearer ${token}` }
    });
    const data = (await response.json()) as { ok?: boolean; secret?: SecretSummary; error?: string };
    if (data.ok !== true || !data.secret) {
        throw new Error(data.error ?? "Failed to fetch secret.");
    }
    return data.secret;
}
