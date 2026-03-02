/**
 * Sends a plain text message to an agent inbox.
 * Expects: baseUrl, token, agentId, and text are valid.
 */
export async function agentsMessageSend(baseUrl: string, token: string, agentId: string, text: string): Promise<void> {
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
