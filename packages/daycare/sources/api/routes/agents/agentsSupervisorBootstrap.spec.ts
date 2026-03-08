import { describe, expect, it, vi } from "vitest";
import { contextForUser } from "../../../engine/agents/context.js";
import { agentsSupervisorBootstrap } from "./agentsSupervisorBootstrap.js";

describe("agentsSupervisorBootstrap", () => {
    it("resolves the supervisor and posts a wrapped bootstrap message", async () => {
        const ctx = contextForUser({ userId: "u1" });
        const agentSupervisorResolve = vi.fn(async () => "supervisor-1");
        const agentPost = vi.fn(async () => undefined);

        const result = await agentsSupervisorBootstrap({
            ctx,
            body: { text: "  Start the release work.  " },
            agentSupervisorResolve,
            agentPost
        });

        expect(result).toEqual({ ok: true, agentId: "supervisor-1" });
        expect(agentSupervisorResolve).toHaveBeenCalledWith(ctx);
        expect(agentPost).toHaveBeenCalledWith(
            ctx,
            { agentId: "supervisor-1" },
            {
                type: "message",
                message: {
                    text: expect.stringContaining("<bootstrap_request>\nStart the release work.\n</bootstrap_request>"),
                    files: []
                },
                context: {}
            }
        );
    });

    it("rejects empty text", async () => {
        const result = await agentsSupervisorBootstrap({
            ctx: contextForUser({ userId: "u1" }),
            body: { text: "   " },
            agentSupervisorResolve: async () => "supervisor-1",
            agentPost: async () => undefined
        });

        expect(result).toEqual({ ok: false, error: "text is required." });
    });
});
