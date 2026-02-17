import { describe, expect, it } from "vitest";

import type { AgentSkill } from "@/types";
import type { Tool } from "@mariozechner/pi-ai";
import { rlmNoToolsPromptBuild } from "./rlmNoToolsPromptBuild.js";

describe("rlmNoToolsPromptBuild", () => {
  it("builds run_python tag instructions with generated stubs", () => {
    const tools = [
      { name: "run_python", description: "", parameters: {} },
      { name: "echo", description: "Echo text", parameters: {} },
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
      }
    ];

    const prompt = rlmNoToolsPromptBuild(tools, skills);

    expect(prompt).toContain("This mode exposes zero tools to the model.");
    expect(prompt).toContain("<run_python>...</run_python>");
    expect(prompt).toContain("first `<run_python>` and last `</run_python>`");
    expect(prompt).toContain("```python");
    expect(prompt).toContain("def echo() -> str:");
    expect(prompt).toContain("Available skills");
    expect(prompt).toContain("- scheduling sandbox=true - Set up recurring tasks");
    expect(prompt).toContain("<python_result>...</python_result>");
  });
});
