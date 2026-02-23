import { describe, expect, it } from "vitest";

import { Context, contextForAgent, contextForUser } from "./context.js";

describe("Context", () => {
    it("builds a user-only context", () => {
        const context = contextForUser({ userId: "user-1" });
        expect(context.userId).toBe("user-1");
        expect(context.hasAgentId).toBe(false);
    });

    it("builds an agent context", () => {
        const context = contextForAgent({ userId: "user-1", agentId: "agent-1" });
        expect(context.userId).toBe("user-1");
        expect(context.agentId).toBe("agent-1");
        expect(context.hasAgentId).toBe(true);
    });

    it("throws when agentId is read from user-only context", () => {
        const context = contextForUser({ userId: "user-1" });
        expect(() => context.agentId).toThrow("Context has no agentId");
    });

    it("is readonly", () => {
        const context = new Context({ userId: "user-1", agentId: "agent-1" });
        const readonlyAssertion = (value: Context): void => {
            // @ts-expect-error Context fields are readonly
            value.agentId = "agent-2";
            // @ts-expect-error Context fields are readonly
            value.userId = "user-2";
        };
        void readonlyAssertion;
        expect(context.agentId).toBe("agent-1");
        expect(context.userId).toBe("user-1");
    });
});
