import { apiUrl } from "../api/apiUrl";
import type { AgentHistoryRecord } from "./chatHistoryTypes";

export type ChatCreatedAgent = {
    agentId: string;
    initializedAt: number;
};

/**
 * Creates an app chat agent and returns its id and initialization timestamp.
 * Expects: baseUrl/token are valid and systemPrompt is non-empty.
 */
export async function chatCreate(
    baseUrl: string,
    token: string,
    workspaceNametag: string | null,
    systemPrompt: string,
    name?: string,
    description?: string
): Promise<ChatCreatedAgent> {
    const response = await fetch(apiUrl(baseUrl, "/agents/create", workspaceNametag), {
        method: "POST",
        headers: {
            authorization: `Bearer ${token}`,
            "content-type": "application/json"
        },
        body: JSON.stringify({
            systemPrompt,
            ...(name !== undefined ? { name } : {}),
            ...(description !== undefined ? { description } : {})
        })
    });
    const data = (await response.json()) as {
        ok?: boolean;
        agent?: { agentId?: string; initializedAt?: number };
        error?: string;
    };
    if (data.ok !== true || !data.agent || typeof data.agent.agentId !== "string") {
        throw new Error(data.error ?? "Failed to create chat agent");
    }
    return {
        agentId: data.agent.agentId,
        initializedAt: typeof data.agent.initializedAt === "number" ? data.agent.initializedAt : 0
    };
}

/**
 * Resolves (or creates) the direct messaging agent for the current user.
 * Expects: baseUrl/token are valid authenticated values.
 */
export async function chatDirectResolve(
    baseUrl: string,
    token: string,
    workspaceNametag: string | null
): Promise<string> {
    const response = await fetch(apiUrl(baseUrl, "/agents/direct", workspaceNametag), {
        headers: { authorization: `Bearer ${token}` }
    });
    const data = (await response.json()) as { ok?: boolean; agentId?: string; error?: string };
    if (data.ok !== true || typeof data.agentId !== "string") {
        throw new Error(data.error ?? "Failed to resolve direct agent");
    }
    return data.agentId;
}

/**
 * Fetches full history for a chat agent.
 * Expects: baseUrl/token/agentId are valid.
 */
export async function chatHistoryFetch(
    baseUrl: string,
    token: string,
    workspaceNametag: string | null,
    agentId: string
): Promise<AgentHistoryRecord[]> {
    const response = await fetch(apiUrl(baseUrl, `/agents/${encodeURIComponent(agentId)}/history`, workspaceNametag), {
        headers: { authorization: `Bearer ${token}` }
    });
    const data = (await response.json()) as { ok?: boolean; history?: AgentHistoryRecord[]; error?: string };
    if (data.ok !== true) {
        throw new Error(data.error ?? "Failed to fetch chat history");
    }
    return data.history ?? [];
}

/**
 * Sends a user message to a chat agent.
 * Expects: baseUrl/token/agentId are valid and text is non-empty.
 */
export async function chatMessageSend(
    baseUrl: string,
    token: string,
    workspaceNametag: string | null,
    agentId: string,
    text: string
): Promise<void> {
    const response = await fetch(apiUrl(baseUrl, `/agents/${encodeURIComponent(agentId)}/message`, workspaceNametag), {
        method: "POST",
        headers: {
            authorization: `Bearer ${token}`,
            "content-type": "application/json"
        },
        body: JSON.stringify({ text })
    });
    const data = (await response.json()) as { ok?: boolean; error?: string };
    if (data.ok !== true) {
        throw new Error(data.error ?? "Failed to send chat message");
    }
}

/**
 * Polls only new history records after the given timestamp.
 * Expects: baseUrl/token/agentId are valid and after >= 0.
 */
export async function chatMessagesPoll(
    baseUrl: string,
    token: string,
    workspaceNametag: string | null,
    agentId: string,
    after: number
): Promise<AgentHistoryRecord[]> {
    const search = new URLSearchParams({
        after: String(after)
    });
    const response = await fetch(
        `${apiUrl(baseUrl, `/agents/${encodeURIComponent(agentId)}/messages`, workspaceNametag)}?${search.toString()}`,
        { headers: { authorization: `Bearer ${token}` } }
    );
    const data = (await response.json()) as { ok?: boolean; history?: AgentHistoryRecord[]; error?: string };
    if (data.ok !== true) {
        throw new Error(data.error ?? "Failed to poll chat messages");
    }
    return data.history ?? [];
}
