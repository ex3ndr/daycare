import type { Context } from "@/types";

export type AgentsDeleteInput = {
    ctx: Context;
    agentId: string;
    agentKill: (ctx: Context, agentId: string) => Promise<boolean>;
};

export type AgentsDeleteResult =
    | {
          ok: true;
          deleted: true;
      }
    | {
          ok: false;
          error: string;
      };

/**
 * Kills one agent and clears any queued work.
 * Expects: agentId is non-empty.
 */
export async function agentsDelete(input: AgentsDeleteInput): Promise<AgentsDeleteResult> {
    const agentId = input.agentId.trim();
    if (!agentId) {
        return { ok: false, error: "agentId is required." };
    }

    const deleted = await input.agentKill(input.ctx, agentId);
    if (!deleted) {
        return { ok: false, error: "Agent not found." };
    }

    return { ok: true, deleted: true };
}
