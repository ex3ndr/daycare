import { describe, expect, it, vi } from "vitest";
import { contextForUser } from "../../../engine/agents/context.js";
import { agentsMessage } from "./agentsMessage.js";

describe("agentsMessage", () => {
    it("sends a valid message", async () => {
        const ctx = contextForUser({ userId: "u1" });
        const agentPost = vi.fn(async () => undefined);

        const result = await agentsMessage({
            ctx,
            agentId: "agent-1",
            text: " Hello ",
            agentPost
        });

        expect(result).toEqual({ ok: true });
        expect(agentPost).toHaveBeenCalledWith(
            ctx,
            { agentId: "agent-1" },
            {
                type: "message",
                message: {
                    text: "Hello",
                    files: []
                },
                context: {}
            }
        );
    });

    it("rejects missing text", async () => {
        const ctx = contextForUser({ userId: "u1" });

        const result = await agentsMessage({
            ctx,
            agentId: "agent-1",
            text: "   ",
            agentPost: async () => undefined
        });

        expect(result).toEqual({ ok: false, error: "text is required." });
    });

    it("rejects missing agentId", async () => {
        const ctx = contextForUser({ userId: "u1" });

        const result = await agentsMessage({
            ctx,
            agentId: "",
            text: "Hello",
            agentPost: async () => undefined
        });

        expect(result).toEqual({ ok: false, error: "agentId is required." });
    });
});
