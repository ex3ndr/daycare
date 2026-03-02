import type { AgentHistoryRecord } from "@/views/agents/agentHistoryTypes";

/**
 * Fetches history records for a single agent.
 * Expects: baseUrl, token, and agentId are valid.
 */
export async function agentsHistoryFetch(
    baseUrl: string,
    token: string,
    agentId: string
): Promise<AgentHistoryRecord[]> {
    const response = await fetch(`${baseUrl}/agents/${encodeURIComponent(agentId)}/history`, {
        headers: { authorization: `Bearer ${token}` }
    });
    const data = (await response.json()) as { ok?: boolean; history?: AgentHistoryRecord[]; error?: string };
    if (data.ok !== true) {
        throw new Error(data.error ?? "Failed to fetch agent history");
    }
    return data.history ?? [];
}
