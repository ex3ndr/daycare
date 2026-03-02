import type { SecretCreateInput, SecretSummary } from "./secretsTypes";

/**
 * Creates a secret in the app API and returns metadata.
 * Expects: input.variables includes at least one entry.
 */
export async function secretCreate(baseUrl: string, token: string, input: SecretCreateInput): Promise<SecretSummary> {
    const response = await fetch(`${baseUrl}/secrets/create`, {
        method: "POST",
        headers: {
            authorization: `Bearer ${token}`,
            "content-type": "application/json"
        },
        body: JSON.stringify(input)
    });
    const data = (await response.json()) as { ok?: boolean; secret?: SecretSummary; error?: string };
    if (data.ok !== true || !data.secret) {
        throw new Error(data.error ?? "Failed to create secret.");
    }
    return data.secret;
}
