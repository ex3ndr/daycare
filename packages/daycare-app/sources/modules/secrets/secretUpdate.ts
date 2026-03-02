import type { SecretSummary, SecretUpdateInput } from "./secretsTypes";

/**
 * Updates a named secret and returns metadata.
 * Expects: name is non-empty and input contains at least one field.
 */
export async function secretUpdate(
    baseUrl: string,
    token: string,
    name: string,
    input: SecretUpdateInput
): Promise<SecretSummary> {
    const response = await fetch(`${baseUrl}/secrets/${encodeURIComponent(name)}/update`, {
        method: "POST",
        headers: {
            authorization: `Bearer ${token}`,
            "content-type": "application/json"
        },
        body: JSON.stringify(input)
    });
    const data = (await response.json()) as { ok?: boolean; secret?: SecretSummary; error?: string };
    if (data.ok !== true || !data.secret) {
        throw new Error(data.error ?? "Failed to update secret.");
    }
    return data.secret;
}
