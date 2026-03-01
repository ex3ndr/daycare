import { describe, expect, it } from "vitest";
import { agentPathMatchesStrategy } from "./agentPathMatchesStrategy.js";
import { agentPath } from "./agentPathTypes.js";

describe("agentPathMatchesStrategy", () => {
    it("matches foreground strategies for user-facing roots", () => {
        expect(agentPathMatchesStrategy(agentPath("/u1/telegram"), "most-recent-foreground")).toBe(true);
        expect(agentPathMatchesStrategy(agentPath("/u1/agent/claude"), "most-recent-foreground")).toBe(true);
        expect(agentPathMatchesStrategy(agentPath("/u1/subuser/s1"), "most-recent-foreground")).toBe(true);
    });

    it("does not match background/system paths", () => {
        expect(agentPathMatchesStrategy(agentPath("/u1/task/t1"), "most-recent-foreground")).toBe(false);
        expect(agentPathMatchesStrategy(agentPath("/u1/telegram/sub/0"), "most-recent-foreground")).toBe(false);
        expect(agentPathMatchesStrategy(agentPath("/system/gc"), "most-recent-foreground")).toBe(false);
    });
});
