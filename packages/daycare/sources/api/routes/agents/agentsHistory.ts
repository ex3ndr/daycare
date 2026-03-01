import type { AgentHistoryRecord, Context } from "@/types";

export type AgentsHistoryInput = {
    ctx: Context;
    agentId: string;
    limit?: number;
    agentHistoryLoad: (ctx: Context, agentId: string, limit?: number) => Promise<AgentHistoryRecord[]>;
};

export type AgentsHistoryResult =
    | {
          ok: true;
          history: AgentHistoryRecord[];
      }
    | {
          ok: false;
          error: string;
      };

/**
 * Loads history records for one agent.
 * Expects: agentId is non-empty and limit, when provided, is a positive integer.
 */
export async function agentsHistory(input: AgentsHistoryInput): Promise<AgentsHistoryResult> {
    const agentId = input.agentId.trim();
    if (!agentId) {
        return { ok: false, error: "agentId is required." };
    }
    if (input.limit !== undefined && (!Number.isInteger(input.limit) || input.limit <= 0)) {
        return { ok: false, error: "limit must be a positive integer." };
    }

    try {
        const history = await input.agentHistoryLoad(input.ctx, agentId, input.limit);
        return { ok: true, history };
    } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to load agent history.";
        return { ok: false, error: message };
    }
}
