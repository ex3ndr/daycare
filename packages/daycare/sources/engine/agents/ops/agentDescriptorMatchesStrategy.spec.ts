import { describe, expect, it } from "vitest";
import { agentDescriptorMatchesStrategy } from "./agentDescriptorMatchesStrategy.js";

describe("agentDescriptorMatchesStrategy", () => {
    it("matches foreground descriptors", () => {
        expect(
            agentDescriptorMatchesStrategy(
                { type: "user", connector: "telegram", userId: "u1", channelId: "c1" },
                "most-recent-foreground"
            )
        ).toBe(true);
        expect(agentDescriptorMatchesStrategy({ type: "swarm", id: "s1" }, "most-recent-foreground")).toBe(true);
    });

    it("does not match background descriptors", () => {
        expect(agentDescriptorMatchesStrategy({ type: "task", id: "t1" }, "most-recent-foreground")).toBe(false);
        expect(agentDescriptorMatchesStrategy({ type: "cron", id: "c1" }, "most-recent-foreground")).toBe(false);
        expect(
            agentDescriptorMatchesStrategy(
                { type: "permanent", id: "p1", name: "assistant", description: "", systemPrompt: "" },
                "most-recent-foreground"
            )
        ).toBe(false);
        expect(
            agentDescriptorMatchesStrategy(
                { type: "subagent", id: "a1", parentAgentId: "p1", name: "child" },
                "most-recent-foreground"
            )
        ).toBe(false);
    });
});
