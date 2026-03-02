import type { Context } from "@/types";
import type { AgentListItem } from "../routeTypes.js";

export type AgentsListInput = {
    ctx: Context;
    agentList: (ctx: Context) => Promise<AgentListItem[]>;
};

export type AgentsListResult = {
    ok: true;
    agents: Array<{
        agentId: string;
        lifecycle: AgentListItem["lifecycle"];
        updatedAt: number;
    }>;
};

/**
 * Lists agents for the authenticated user.
 * Expects: callback returns agent metadata and may include optional userId for extra filtering.
 */
export async function agentsList(input: AgentsListInput): Promise<AgentsListResult> {
    const allAgents = await input.agentList(input.ctx);
    const agents = allAgents
        .filter((agent) => agent.userId === undefined || agent.userId === input.ctx.userId)
        .map((agent) => ({
            agentId: agent.agentId,
            lifecycle: agent.lifecycle,
            updatedAt: agent.updatedAt
        }));

    return { ok: true, agents };
}
