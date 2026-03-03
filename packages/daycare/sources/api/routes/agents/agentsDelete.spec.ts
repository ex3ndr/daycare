import { describe, expect, it, vi } from "vitest";
import { contextForUser } from "../../../engine/agents/context.js";
import { agentsDelete } from "./agentsDelete.js";

describe("agentsDelete", () => {
    it("kills an existing agent", async () => {
        const ctx = contextForUser({ userId: "u1" });
        const agentKill = vi.fn(async () => true);

        const result = await agentsDelete({
            ctx,
            agentId: "agent-1",
            agentKill
        });

        expect(result).toEqual({ ok: true, deleted: true });
        expect(agentKill).toHaveBeenCalledWith(ctx, "agent-1");
    });

    it("returns not found when kill returns false", async () => {
        const result = await agentsDelete({
            ctx: contextForUser({ userId: "u1" }),
            agentId: "agent-missing",
            agentKill: async () => false
        });

        expect(result).toEqual({ ok: false, error: "Agent not found." });
    });

    it("rejects empty agentId", async () => {
        const result = await agentsDelete({
            ctx: contextForUser({ userId: "u1" }),
            agentId: "   ",
            agentKill: async () => true
        });

        expect(result).toEqual({ ok: false, error: "agentId is required." });
    });
});
