import { describe, expect, it, vi } from "vitest";
import { contextForUser } from "../../../engine/agents/context.js";
import { agentsMessagesRead } from "./agentsMessagesRead.js";

describe("agentsMessagesRead", () => {
    it("loads messages after a timestamp", async () => {
        const ctx = contextForUser({ userId: "u1" });
        const agentHistoryLoadAfter = vi.fn(async () => [
            { type: "assistant_message" as const, at: 20, content: [], tokens: null }
        ]);

        const result = await agentsMessagesRead({
            ctx,
            agentId: "agent-1",
            after: 10,
            agentHistoryLoadAfter
        });

        expect(result).toEqual({
            ok: true,
            history: [{ type: "assistant_message", at: 20, content: [], tokens: null }]
        });
        expect(agentHistoryLoadAfter).toHaveBeenCalledWith(ctx, "agent-1", 10, undefined);
    });

    it("passes limit", async () => {
        const ctx = contextForUser({ userId: "u1" });
        const agentHistoryLoadAfter = vi.fn(async () => []);

        await agentsMessagesRead({
            ctx,
            agentId: "agent-1",
            after: 0,
            limit: 5,
            agentHistoryLoadAfter
        });

        expect(agentHistoryLoadAfter).toHaveBeenCalledWith(ctx, "agent-1", 0, 5);
    });

    it("validates input", async () => {
        const ctx = contextForUser({ userId: "u1" });

        await expect(
            agentsMessagesRead({
                ctx,
                agentId: "",
                after: 0,
                agentHistoryLoadAfter: async () => []
            })
        ).resolves.toEqual({ ok: false, error: "agentId is required." });

        await expect(
            agentsMessagesRead({
                ctx,
                agentId: "a",
                after: -1,
                agentHistoryLoadAfter: async () => []
            })
        ).resolves.toEqual({ ok: false, error: "after must be a non-negative unix timestamp in milliseconds." });

        await expect(
            agentsMessagesRead({
                ctx,
                agentId: "a",
                after: 0,
                limit: 0,
                agentHistoryLoadAfter: async () => []
            })
        ).resolves.toEqual({ ok: false, error: "limit must be a positive integer." });
    });
});
