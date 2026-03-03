import { describe, expect, it, vi } from "vitest";
import { contextForUser } from "../../../engine/agents/context.js";
import { agentsCreate } from "./agentsCreate.js";

describe("agentsCreate", () => {
    it("creates an agent with required prompt", async () => {
        const ctx = contextForUser({ userId: "u1" });
        const agentCreate = vi.fn(async () => ({ agentId: "agent-1", initializedAt: 1_700_000_000_000 }));

        const result = await agentsCreate({
            ctx,
            body: {
                systemPrompt: "  You are a helper.  "
            },
            agentCreate
        });

        expect(result).toEqual({
            ok: true,
            agent: {
                agentId: "agent-1",
                initializedAt: 1_700_000_000_000
            }
        });
        expect(agentCreate).toHaveBeenCalledWith(ctx, {
            systemPrompt: "You are a helper."
        });
    });

    it("passes optional name and description", async () => {
        const ctx = contextForUser({ userId: "u1" });
        const agentCreate = vi.fn(async () => ({ agentId: "agent-2", initializedAt: 2 }));

        await agentsCreate({
            ctx,
            body: {
                systemPrompt: "Prompt",
                name: "  App Agent  ",
                description: "  Started from app  "
            },
            agentCreate
        });

        expect(agentCreate).toHaveBeenCalledWith(ctx, {
            systemPrompt: "Prompt",
            name: "App Agent",
            description: "Started from app"
        });
    });

    it("rejects missing systemPrompt", async () => {
        const result = await agentsCreate({
            ctx: contextForUser({ userId: "u1" }),
            body: { systemPrompt: "   " },
            agentCreate: async () => ({ agentId: "a", initializedAt: 1 })
        });

        expect(result).toEqual({ ok: false, error: "systemPrompt is required." });
    });

    it("rejects invalid optional fields", async () => {
        const ctx = contextForUser({ userId: "u1" });

        await expect(
            agentsCreate({
                ctx,
                body: { systemPrompt: "ok", name: 1 },
                agentCreate: async () => ({ agentId: "a", initializedAt: 1 })
            })
        ).resolves.toEqual({ ok: false, error: "name must be a string or null." });

        await expect(
            agentsCreate({
                ctx,
                body: { systemPrompt: "ok", description: false },
                agentCreate: async () => ({ agentId: "a", initializedAt: 1 })
            })
        ).resolves.toEqual({ ok: false, error: "description must be a string or null." });
    });
});
