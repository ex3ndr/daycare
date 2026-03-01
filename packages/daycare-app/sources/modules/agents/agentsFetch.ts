import type { AgentListItem } from "./agentsTypes";

/**
 * Fetches the list of agents from the app-server.
 * Expects: baseUrl and token are valid (user is authenticated).
 */
export async function agentsFetch(baseUrl: string, token: string): Promise<AgentListItem[]> {
    const response = await fetch(`${baseUrl}/agents`, {
        headers: { authorization: `Bearer ${token}` }
    });
    const data = (await response.json()) as { ok?: boolean; agents?: AgentListItem[]; error?: string };
    if (data.ok !== true) {
        throw new Error(data.error ?? "Failed to fetch agents");
    }
    return data.agents ?? [];
}
