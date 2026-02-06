import { describe, expect, it } from "vitest";

import { agentPermanentPromptBuild } from "./agentPermanentPromptBuild.js";

const baseAgent = {
  type: "permanent" as const,
  id: "agent-id",
  name: "",
  systemPrompt: "",
  description: ""
};

describe("agentPermanentPromptBuild", () => {
  it("returns empty string when no agents are provided", () => {
    expect(agentPermanentPromptBuild([])).toBe("");
  });

  it("formats and sorts permanent agents", () => {
    const result = agentPermanentPromptBuild([
      {
        agentId: "b-id",
        descriptor: {
          ...baseAgent,
          id: "b-id",
          name: "Beta",
          systemPrompt: "Use <tags>",
          description: "Handles & checks"
        },
        updatedAt: 2
      },
      {
        agentId: "a-id",
        descriptor: {
          ...baseAgent,
          id: "a-id",
          name: "alpha",
          systemPrompt: "Stay & calm",
          description: "Tracks <releases>",
          workspaceDir: "/workspace/alpha"
        },
        updatedAt: 1
      }
    ]);

    expect(result.indexOf("<name>alpha</name>")).toBeLessThan(
      result.indexOf("<name>Beta</name>")
    );
    expect(result).not.toContain("system_prompt");
    expect(result).toContain("<workspace>/workspace/alpha</workspace>");
    expect(result).toContain("Tracks &lt;releases&gt;");
    expect(result).toContain("Handles &amp; checks");
  });
});
