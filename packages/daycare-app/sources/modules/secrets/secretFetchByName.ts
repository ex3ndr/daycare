import type { SecretSummary } from "./secretsTypes";

/**
 * Fetches one secret summary by name.
 * Expects: baseUrl and token are valid.
 */
export async function secretFetchByName(baseUrl: string, token: string, name: string): Promise<SecretSummary> {
    const response = await fetch(`${baseUrl}/secrets/${encodeURIComponent(name)}`, {
        headers: { authorization: `Bearer ${token}` }
    });
    const data = (await response.json()) as { ok?: boolean; secret?: SecretSummary; error?: string };
    if (data.ok !== true || !data.secret) {
        throw new Error(data.error ?? "Failed to fetch secret.");
    }
    return data.secret;
}
