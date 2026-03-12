import { describe, expect, it } from "vitest";

import { agentDisplayName } from "./agentDisplayName";
import type { AgentListItem } from "./agentsTypes";

function agentCreate(overrides: Partial<AgentListItem> & { agentId: string }): AgentListItem {
    const { agentId, ...rest } = overrides;
    return {
        agentId,
        path: null,
        kind: "agent",
        name: null,
        description: null,
        connector: null,
        foreground: false,
        lifecycle: "active",
        createdAt: 1000,
        updatedAt: 1000,
        ...rest
    };
}

describe("agentDisplayName", () => {
    it("uses explicit connector metadata for connector agents", () => {
        expect(
            agentDisplayName(
                agentCreate({
                    agentId: "a1",
                    kind: "connector",
                    connector: { name: "telegram", key: "123" }
                })
            )
        ).toBe("Telegram");
    });

    it("does not parse path segments for generic agents", () => {
        expect(
            agentDisplayName(
                agentCreate({
                    agentId: "agent-12345678",
                    kind: "agent",
                    path: "/user-1/agent/legacy-name"
                })
            )
        ).toBe("Agent agent-12");
    });

    it("prefers the explicit agent name when present", () => {
        expect(agentDisplayName(agentCreate({ agentId: "a1", name: "assistant" }))).toBe("Assistant");
    });
});
