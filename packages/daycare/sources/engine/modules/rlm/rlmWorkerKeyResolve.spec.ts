import { describe, expect, it } from "vitest";
import { rlmWorkerKeyResolve } from "./rlmWorkerKeyResolve.js";

describe("rlmWorkerKeyResolve", () => {
    it("returns user and agent key when agent id is available", () => {
        const key = rlmWorkerKeyResolve({
            userId: "user-1",
            hasAgentId: true,
            agentId: "agent-1"
        });
        expect(key).toBe("user-1:agent-1");
    });

    it("falls back to user-scoped key when no agent id exists", () => {
        const context = {
            userId: "user-1",
            hasAgentId: false,
            agentId: "agent-ignored"
        };
        expect(rlmWorkerKeyResolve(context)).toBe("user-1:_user");
    });
});
