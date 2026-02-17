import { describe, expect, it } from "vitest";

import type { Tool } from "@mariozechner/pi-ai";
import { rlmNoToolsPromptBuild } from "./rlmNoToolsPromptBuild.js";

describe("rlmNoToolsPromptBuild", () => {
  it("renders no-tools run_python tag instructions with generated stubs", async () => {
    const tools = [
      { name: "run_python", description: "", parameters: {} },
      { name: "echo", description: "Echo text", parameters: {} },
      { name: "skill", description: "Load skill", parameters: {} }
    ] as unknown as Tool[];

    const prompt = await rlmNoToolsPromptBuild(tools);

    expect(prompt).toContain("This mode exposes zero tools to the model.");
    expect(prompt).toContain("<run_python>...</run_python>");
    expect(prompt).toContain("Emit at most one Python block per assistant response.");
    expect(prompt).toContain("write one multi-line script in that block");
    expect(prompt).toContain("Do not split one task into multiple separate scripts");
    expect(prompt).toContain("Tools return plain LLM strings");
    expect(prompt).toContain("first `<run_python>` and last `</run_python>`");
    expect(prompt).toContain("`<say>` blocks must come before `<run_python>`");
    expect(prompt).toContain("```python");
    expect(prompt).toContain("def echo() -> str:");
    expect(prompt).not.toContain("Available skills");
    expect(prompt).toContain("<python_result>...</python_result>");
    expect(prompt).toContain("do not use `print()` for the final return value");
    expect(prompt).toContain("emit `<say>` only if you have new user-facing information");
    expect(prompt).toContain("do not repeat the same message");
    expect(prompt.indexOf("Call functions directly (no `await`).")).toBeLessThan(
      prompt.indexOf("Available functions:")
    );
    expect(prompt.match(/Use `try\/except ToolError` for tool failures\./g)?.length ?? 0).toBe(1);
  });
});
