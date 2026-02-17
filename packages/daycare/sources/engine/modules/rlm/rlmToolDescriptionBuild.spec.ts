import { describe, expect, it } from "vitest";

import type { Tool } from "@mariozechner/pi-ai";
import { rlmToolDescriptionBuild } from "./rlmToolDescriptionBuild.js";

describe("rlmToolDescriptionBuild", () => {
  it("renders the bundled template with generated stubs and no embedded skills", async () => {
    const tools = [
      { name: "run_python", description: "", parameters: {} },
      { name: "skill", description: "Load skill", parameters: {} }
    ] as unknown as Tool[];

    const description = await rlmToolDescriptionBuild(tools);
    expect(description).toContain("Execute Python code to complete the task.");
    expect(description).toContain("prefer one multi-line Python script for the full task");
    expect(description).toContain("Do not split one task into multiple separate Python scripts");
    expect(description).toContain("Tools return plain LLM strings");
    expect(description).toContain("The following functions are available:");
    expect(description).toContain("```python");
    expect(description).toContain("def skill() -> str:");
    expect(description).not.toContain("Available skills");
  });
});
