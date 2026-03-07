import type { Context } from "@/types";

export type AgentsDirectInput = {
    ctx: Context;
    agentDirectResolve: (ctx: Context) => Promise<string>;
};

export type AgentsDirectResult =
    | {
          ok: true;
          agentId: string;
      }
    | {
          ok: false;
          error: string;
      };

/**
 * Resolves the direct messaging agent for the authenticated user.
 * Creates the agent if it does not exist yet.
 *
 * Expects: ctx carries authenticated userId.
 */
export async function agentsDirect(input: AgentsDirectInput): Promise<AgentsDirectResult> {
    try {
        const agentId = await input.agentDirectResolve(input.ctx);
        return { ok: true, agentId };
    } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to resolve direct agent.";
        return { ok: false, error: message };
    }
}
