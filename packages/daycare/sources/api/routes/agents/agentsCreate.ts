import type { Context } from "@/types";
import type { AgentCreateInput } from "../routeTypes.js";

export type AgentsCreateHandlerInput = {
    ctx: Context;
    body: Record<string, unknown>;
    agentCreate: (ctx: Context, input: AgentCreateInput) => Promise<{ agentId: string; initializedAt: number }>;
};

export type AgentsCreateResult =
    | {
          ok: true;
          agent: {
              agentId: string;
              initializedAt: number;
          };
      }
    | {
          ok: false;
          error: string;
      };

/**
 * Creates an app-scoped API agent.
 * Expects: systemPrompt is non-empty; optional name/description are string or null.
 */
export async function agentsCreate(input: AgentsCreateHandlerInput): Promise<AgentsCreateResult> {
    const systemPrompt = typeof input.body.systemPrompt === "string" ? input.body.systemPrompt.trim() : "";
    if (!systemPrompt) {
        return { ok: false, error: "systemPrompt is required." };
    }

    let name: string | null | undefined;
    if (input.body.name !== undefined) {
        if (input.body.name !== null && typeof input.body.name !== "string") {
            return { ok: false, error: "name must be a string or null." };
        }
        name = input.body.name === null ? null : input.body.name.trim();
    }

    let description: string | null | undefined;
    if (input.body.description !== undefined) {
        if (input.body.description !== null && typeof input.body.description !== "string") {
            return { ok: false, error: "description must be a string or null." };
        }
        description = input.body.description === null ? null : input.body.description.trim();
    }

    try {
        const created = await input.agentCreate(input.ctx, {
            systemPrompt,
            ...(name !== undefined ? { name } : {}),
            ...(description !== undefined ? { description } : {})
        });
        return {
            ok: true,
            agent: {
                agentId: created.agentId,
                initializedAt: created.initializedAt
            }
        };
    } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to create agent.";
        return { ok: false, error: message };
    }
}
