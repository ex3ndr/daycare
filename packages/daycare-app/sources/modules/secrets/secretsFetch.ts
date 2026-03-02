import type { SecretSummary } from "./secretsTypes";

/**
 * Fetches all saved secrets as metadata-only summaries.
 * Expects: baseUrl and token are valid.
 */
export async function secretsFetch(baseUrl: string, token: string): Promise<SecretSummary[]> {
    const response = await fetch(`${baseUrl}/secrets`, {
        headers: { authorization: `Bearer ${token}` }
    });
    const data = (await response.json()) as { ok?: boolean; secrets?: SecretSummary[]; error?: string };
    if (data.ok !== true) {
        throw new Error(data.error ?? "Failed to fetch secrets.");
    }
    return data.secrets ?? [];
}
