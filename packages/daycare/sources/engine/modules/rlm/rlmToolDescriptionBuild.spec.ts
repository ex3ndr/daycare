import { describe, expect, it } from "vitest";

import type { AgentSkill } from "@/types";
import type { Tool } from "@mariozechner/pi-ai";
import { rlmToolDescriptionBuild } from "./rlmToolDescriptionBuild.js";

describe("rlmToolDescriptionBuild", () => {
  it("embeds skill metadata when provided", () => {
    const tools = [
      { name: "run_python", description: "", parameters: {} },
      { name: "skill", description: "Load skill", parameters: {} }
    ] as unknown as Tool[];
    const skills: AgentSkill[] = [
      {
        id: "core:scheduling",
        name: "scheduling",
        description: "Set up recurring tasks",
        source: "core",
        path: "/tmp/skills/scheduling/SKILL.md",
        sandbox: true
      },
      {
        id: "config:review",
        name: "review",
        description: null,
        source: "config",
        path: "/tmp/skills/review/SKILL.md"
      }
    ];

    const description = rlmToolDescriptionBuild(tools, skills);
    expect(description).toContain("Available skills");
    expect(description).toContain("- scheduling sandbox=true - Set up recurring tasks");
    expect(description).toContain("- review");
  });
});
