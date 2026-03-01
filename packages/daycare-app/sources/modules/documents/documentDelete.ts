/**
 * Deletes a document via the API (soft-delete).
 * Expects: baseUrl and token are valid; id is a valid document identifier.
 */
export async function documentDelete(baseUrl: string, token: string, id: string): Promise<void> {
    const response = await fetch(`${baseUrl}/documents/${encodeURIComponent(id)}`, {
        method: "DELETE",
        headers: { authorization: `Bearer ${token}` }
    });
    const data = (await response.json()) as { ok?: boolean; error?: string };
    if (data.ok !== true) {
        throw new Error(data.error ?? "Failed to delete document.");
    }
}
