import type { AgentHistoryRecord, Context } from "@/types";

export type AgentsMessagesReadInput = {
    ctx: Context;
    agentId: string;
    after: number;
    limit?: number;
    agentHistoryLoadAfter: (
        ctx: Context,
        agentId: string,
        after: number,
        limit?: number
    ) => Promise<AgentHistoryRecord[]>;
};

export type AgentsMessagesReadResult =
    | {
          ok: true;
          history: AgentHistoryRecord[];
      }
    | {
          ok: false;
          error: string;
      };

/**
 * Reads agent history records created after a unix timestamp.
 * Expects: agentId is non-empty; after is >= 0; limit is a positive integer when provided.
 */
export async function agentsMessagesRead(input: AgentsMessagesReadInput): Promise<AgentsMessagesReadResult> {
    const agentId = input.agentId.trim();
    if (!agentId) {
        return { ok: false, error: "agentId is required." };
    }
    if (!Number.isInteger(input.after) || input.after < 0) {
        return { ok: false, error: "after must be a non-negative unix timestamp in milliseconds." };
    }
    if (input.limit !== undefined && (!Number.isInteger(input.limit) || input.limit <= 0)) {
        return { ok: false, error: "limit must be a positive integer." };
    }

    try {
        const history = await input.agentHistoryLoadAfter(input.ctx, agentId, input.after, input.limit);
        return { ok: true, history };
    } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to load agent history.";
        return { ok: false, error: message };
    }
}
