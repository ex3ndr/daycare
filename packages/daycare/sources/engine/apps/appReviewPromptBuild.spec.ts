import { describe, expect, it } from "vitest";

import { appReviewPromptBuild } from "./appReviewPromptBuild.js";

describe("appReviewPromptBuild", () => {
  it("includes tool details and allow/deny rules", () => {
    const prompt = appReviewPromptBuild({
      appName: "GitHub Reviewer",
      appSystemPrompt:
        "You are a secure review assistant. Use only approved tooling and avoid destructive actions.",
      sourceIntent: "Review pull requests safely.",
      toolName: "exec",
      args: { command: "git diff" },
      availableTools: [
        {
          name: "exec",
          description: "Run a shell command in the workspace.",
          parameters: {
            type: "object",
            properties: { command: { type: "string" } },
            required: ["command"]
          }
        }
      ],
      rules: {
        allow: [{ text: "Run read-only git commands" }],
        deny: [{ text: "Rewrite git history" }]
      }
    });

    expect(prompt).toContain('app "GitHub Reviewer"');
    expect(prompt).toContain("- Tool: exec");
    expect(prompt).toContain('"command": "git diff"');
    expect(prompt).toContain("## Available Tools In This Sandbox");
    expect(prompt).toContain("Name: exec");
    expect(prompt).toContain("not Python exec()");
    expect(prompt).toContain("## App System Prompt");
    expect(prompt).toContain("You are a secure review assistant.");
    expect(prompt).toContain("Review pull requests safely.");
    expect(prompt).toContain("- Run read-only git commands");
    expect(prompt).toContain("- Rewrite git history");
    expect(prompt).toContain("DENY: <reason>");
  });
});
