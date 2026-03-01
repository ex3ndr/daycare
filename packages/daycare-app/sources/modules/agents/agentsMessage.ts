/**
 * Sends a text message to a specific agent.
 * Expects: baseUrl, token, and agentId are valid.
 */
export async function agentsMessage(baseUrl: string, token: string, agentId: string, text: string): Promise<void> {
    const response = await fetch(`${baseUrl}/agents/${encodeURIComponent(agentId)}/message`, {
        method: "POST",
        headers: {
            authorization: `Bearer ${token}`,
            "content-type": "application/json"
        },
        body: JSON.stringify({ text })
    });
    const data = (await response.json()) as { ok?: boolean; error?: string };
    if (data.ok !== true) {
        throw new Error(data.error ?? "Failed to send message");
    }
}
