import { apiUrl } from "../api/apiUrl";
import type { AgentTurn } from "./turnTypes";

/**
 * Fetches turn-grouped history for an agent.
 * Expects: baseUrl/token/agentId are valid.
 */
export async function turnsFetch(
    baseUrl: string,
    token: string,
    workspaceId: string | null,
    agentId: string
): Promise<AgentTurn[]> {
    const response = await fetch(apiUrl(baseUrl, `/agents/${encodeURIComponent(agentId)}/turns`, workspaceId), {
        headers: { authorization: `Bearer ${token}` }
    });
    const data = (await response.json()) as { ok?: boolean; turns?: AgentTurn[]; error?: string };
    if (data.ok !== true) {
        throw new Error(data.error ?? "Failed to fetch agent turns");
    }
    return data.turns ?? [];
}
