import { describe, expect, it } from "vitest";

import { agentPermanentPrompt } from "./agentPermanentPrompt.js";

const baseAgent = {
    name: "",
    systemPrompt: "",
    description: "",
    workspaceDir: null as string | null
};

describe("agentPermanentPrompt", () => {
    it("returns empty string when no agents are provided", () => {
        expect(agentPermanentPrompt([])).toBe("");
    });

    it("formats and sorts permanent agents", () => {
        const result = agentPermanentPrompt([
            {
                agentId: "b-id",
                ...baseAgent,
                name: "Beta",
                systemPrompt: "Use <tags>",
                description: "Handles & checks",
                updatedAt: 2
            },
            {
                agentId: "a-id",
                ...baseAgent,
                name: "alpha",
                systemPrompt: "Stay & calm",
                description: "Tracks <releases>",
                workspaceDir: "/workspace/alpha",
                updatedAt: 1
            }
        ]);

        expect(result.indexOf("<name>alpha</name>")).toBeLessThan(result.indexOf("<name>Beta</name>"));
        expect(result).not.toContain("system_prompt");
        expect(result).toContain("<workspace>/workspace/alpha</workspace>");
        expect(result).toContain("Tracks &lt;releases&gt;");
        expect(result).toContain("Handles &amp; checks");
    });
});
