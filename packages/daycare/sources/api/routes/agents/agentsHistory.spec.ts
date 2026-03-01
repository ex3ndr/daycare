import { describe, expect, it, vi } from "vitest";
import { contextForUser } from "../../../engine/agents/context.js";
import { agentsHistory } from "./agentsHistory.js";

describe("agentsHistory", () => {
    it("returns history records", async () => {
        const ctx = contextForUser({ userId: "u1" });
        const agentHistoryLoad = vi.fn(async () => [{ type: "note" as const, at: 1, text: "n" }]);

        const result = await agentsHistory({
            ctx,
            agentId: "agent-1",
            agentHistoryLoad
        });

        expect(result).toEqual({ ok: true, history: [{ type: "note", at: 1, text: "n" }] });
        expect(agentHistoryLoad).toHaveBeenCalledWith(ctx, "agent-1", undefined);
    });

    it("passes limit to callback", async () => {
        const ctx = contextForUser({ userId: "u1" });
        const agentHistoryLoad = vi.fn(async () => []);

        const result = await agentsHistory({
            ctx,
            agentId: "agent-1",
            limit: 50,
            agentHistoryLoad
        });

        expect(result).toEqual({ ok: true, history: [] });
        expect(agentHistoryLoad).toHaveBeenCalledWith(ctx, "agent-1", 50);
    });

    it("returns empty history", async () => {
        const ctx = contextForUser({ userId: "u1" });

        const result = await agentsHistory({
            ctx,
            agentId: "agent-1",
            agentHistoryLoad: async () => []
        });

        expect(result).toEqual({ ok: true, history: [] });
    });

    it("rejects missing agentId", async () => {
        const ctx = contextForUser({ userId: "u1" });

        const result = await agentsHistory({
            ctx,
            agentId: "   ",
            agentHistoryLoad: async () => []
        });

        expect(result).toEqual({ ok: false, error: "agentId is required." });
    });

    it("rejects invalid limit", async () => {
        const ctx = contextForUser({ userId: "u1" });

        const result = await agentsHistory({
            ctx,
            agentId: "agent-1",
            limit: 0,
            agentHistoryLoad: async () => []
        });

        expect(result).toEqual({ ok: false, error: "limit must be a positive integer." });
    });
});
