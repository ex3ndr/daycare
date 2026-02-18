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
    expect(prompt).toContain("You may include multiple `<run_python>` blocks in one response.");
    expect(prompt).toContain("executed sequentially from top to bottom");
    expect(prompt).toContain("all remaining `<run_python>` blocks in that response are skipped");
    expect(prompt).toContain("Tools return plain LLM strings");
    expect(prompt).toContain("Any `<say>` block after the first `<run_python>` is trimmed and not delivered");
    expect(prompt).not.toContain("<say> after <run_python> was ignored");
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

  it("omits say-tag instructions for non-foreground agents", async () => {
    const tools = [
      { name: "run_python", description: "", parameters: {} },
      { name: "echo", description: "Echo text", parameters: {} }
    ] as unknown as Tool[];

    const prompt = await rlmNoToolsPromptBuild(tools, { isForeground: false });

    expect(prompt).not.toContain("If you include `<say>` in the same response");
    expect(prompt).not.toContain("emit `<say>` only if you have new user-facing information");
    expect(prompt).not.toContain("<say>Starting checks</say>");
    expect(prompt).toContain("<run_python>...</run_python>");
  });
});
