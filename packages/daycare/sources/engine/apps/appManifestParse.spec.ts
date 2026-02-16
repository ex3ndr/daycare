import { describe, expect, it } from "vitest";

import { appManifestParse } from "./appManifestParse.js";

describe("appManifestParse", () => {
  it("parses frontmatter fields", () => {
    const manifest = appManifestParse(
      [
        "---",
        "name: github-reviewer",
        "title: GitHub Reviewer",
        "description: Reviews pull requests",
        "model: gpt-4.1-mini",
        "---",
        "",
        "## System Prompt",
        "",
        "You are a focused PR review assistant."
      ].join("\n")
    );

    expect(manifest).toEqual({
      name: "github-reviewer",
      title: "GitHub Reviewer",
      description: "Reviews pull requests",
      model: "gpt-4.1-mini",
      systemPrompt: "You are a focused PR review assistant."
    });
  });

  it("throws when required frontmatter fields are missing", () => {
    const content = [
      "---",
      "name: missing-description",
      "title: Missing description",
      "---",
      "",
      "## System Prompt",
      "",
      "prompt"
    ].join("\n");

    expect(() => appManifestParse(content)).toThrow(
      "APP.md frontmatter must include name, title, and description."
    );
  });

  it("throws when system prompt section is missing", () => {
    const content = [
      "---",
      "name: github-reviewer",
      "title: GitHub Reviewer",
      "description: Reviews pull requests",
      "---"
    ].join("\n");

    expect(() => appManifestParse(content)).toThrow(
      "APP.md must include a non-empty `## System Prompt` section."
    );
  });

  it("throws on malformed yaml", () => {
    const content = [
      "---",
      "name: github-reviewer",
      "title: [not closed",
      "---"
    ].join("\n");

    expect(() => appManifestParse(content)).toThrow("Invalid APP.md frontmatter.");
  });
});
