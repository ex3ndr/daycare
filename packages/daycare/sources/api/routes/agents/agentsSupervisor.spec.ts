import { describe, expect, it, vi } from "vitest";
import { contextForUser } from "../../../engine/agents/context.js";
import { agentsSupervisor } from "./agentsSupervisor.js";

describe("agentsSupervisor", () => {
    it("resolves the singleton supervisor agent", async () => {
        const ctx = contextForUser({ userId: "u1" });
        const agentSupervisorResolve = vi.fn(async () => "supervisor-1");

        const result = await agentsSupervisor({
            ctx,
            agentSupervisorResolve
        });

        expect(result).toEqual({ ok: true, agentId: "supervisor-1" });
        expect(agentSupervisorResolve).toHaveBeenCalledWith(ctx);
    });

    it("returns resolver failures", async () => {
        const ctx = contextForUser({ userId: "u1" });

        const result = await agentsSupervisor({
            ctx,
            agentSupervisorResolve: async () => {
                throw new Error("boom");
            }
        });

        expect(result).toEqual({ ok: false, error: "boom" });
    });
});
