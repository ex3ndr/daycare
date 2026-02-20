import { describe, expect, it } from "vitest";

import { AgentContext } from "./agentContext.js";

describe("AgentContext", () => {
    it("stores agentId and userId from constructor", () => {
        const context = new AgentContext("agent-1", "user-1");
        expect(context.agentId).toBe("agent-1");
        expect(context.userId).toBe("user-1");
    });

    it("is readonly", () => {
        const context = new AgentContext("agent-1", "user-1");
        const readonlyAssertion = (value: AgentContext): void => {
            // @ts-expect-error AgentContext fields are readonly
            value.agentId = "agent-2";
            // @ts-expect-error AgentContext fields are readonly
            value.userId = "user-2";
        };
        void readonlyAssertion;
        expect(context.agentId).toBe("agent-1");
        expect(context.userId).toBe("user-1");
    });
});
