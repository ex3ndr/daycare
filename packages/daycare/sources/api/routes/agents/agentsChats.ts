import type { Context } from "@/types";
import type { AgentListItem } from "../routeTypes.js";

export type AgentsChatsInput = {
    ctx: Context;
    agentList: (ctx: Context) => Promise<AgentListItem[]>;
};

export type AgentsChatsResult = {
    ok: true;
    chats: Array<{
        agentId: string;
        name: string | null;
        description: string | null;
        lifecycle: AgentListItem["lifecycle"];
        createdAt: number;
        updatedAt: number;
    }>;
};

/**
 * Lists app chat sessions for the authenticated user.
 * Expects: callback returns agent metadata and may include optional userId for extra filtering.
 */
export async function agentsChats(input: AgentsChatsInput): Promise<AgentsChatsResult> {
    const allAgents = await input.agentList(input.ctx);
    const chats = allAgents
        .filter((agent) => agent.kind === "app")
        .filter((agent) => agent.userId === undefined || agent.userId === input.ctx.userId)
        .map((agent) => ({
            agentId: agent.agentId,
            name: agent.name,
            description: agent.description,
            lifecycle: agent.lifecycle,
            createdAt: agent.createdAt,
            updatedAt: agent.updatedAt
        }))
        .sort((a, b) => b.updatedAt - a.updatedAt);

    return { ok: true, chats };
}
