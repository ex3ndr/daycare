import { apiUrl } from "../api/apiUrl";

/**
 * Sends a bootstrap mission text to the supervisor agent.
 * Expects: baseUrl and token are valid; text is non-empty.
 */
export async function supervisorBootstrap(
    baseUrl: string,
    token: string,
    workspaceId: string,
    text: string
): Promise<{ agentId: string }> {
    const response = await fetch(apiUrl(baseUrl, "/agents/supervisor/bootstrap", workspaceId), {
        method: "POST",
        headers: {
            authorization: `Bearer ${token}`,
            "content-type": "application/json"
        },
        body: JSON.stringify({ text })
    });
    const data = (await response.json()) as { ok?: boolean; agentId?: string; error?: string };
    if (data.ok !== true) {
        throw new Error(data.error ?? "Failed to bootstrap supervisor");
    }
    if (!data.agentId) {
        throw new Error("agentId missing from response");
    }
    return { agentId: data.agentId };
}
