import type { Context } from "@/types";

export type AgentsSupervisorInput = {
    ctx: Context;
    agentSupervisorResolve: (ctx: Context) => Promise<string>;
};

export type AgentsSupervisorResult =
    | {
          ok: true;
          agentId: string;
      }
    | {
          ok: false;
          error: string;
      };

/**
 * Resolves the singleton supervisor agent for the authenticated user.
 * Creates the agent when it does not exist yet.
 */
export async function agentsSupervisor(input: AgentsSupervisorInput): Promise<AgentsSupervisorResult> {
    try {
        const agentId = await input.agentSupervisorResolve(input.ctx);
        return { ok: true, agentId };
    } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to resolve supervisor agent.";
        return { ok: false, error: message };
    }
}
