import type { Context } from "@/types";
import { agentsSupervisorBootstrapTextBuild } from "./agentsSupervisorBootstrapTextBuild.js";

export type AgentsSupervisorBootstrapInput = {
    ctx: Context;
    body: Record<string, unknown>;
    agentSupervisorResolve: (ctx: Context) => Promise<string>;
    agentPost: (
        ctx: Context,
        target: { agentId: string },
        item: { type: "message"; message: { text: string; files: [] }; context: Record<string, never> }
    ) => Promise<void>;
};

export type AgentsSupervisorBootstrapResult =
    | {
          ok: true;
          agentId: string;
      }
    | {
          ok: false;
          error: string;
      };

/**
 * Sends a client bootstrap message to the user's supervisor agent.
 * Creates the supervisor when missing and merges the user text with bootstrap guidance.
 */
export async function agentsSupervisorBootstrap(
    input: AgentsSupervisorBootstrapInput
): Promise<AgentsSupervisorBootstrapResult> {
    const text = typeof input.body.text === "string" ? input.body.text.trim() : "";
    if (!text) {
        return { ok: false, error: "text is required." };
    }

    try {
        const agentId = await input.agentSupervisorResolve(input.ctx);
        await input.agentPost(
            input.ctx,
            { agentId },
            {
                type: "message",
                message: {
                    text: agentsSupervisorBootstrapTextBuild(text),
                    files: []
                },
                context: {}
            }
        );
        return { ok: true, agentId };
    } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to bootstrap supervisor agent.";
        return { ok: false, error: message };
    }
}
