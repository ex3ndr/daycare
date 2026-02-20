import { describe, expect, it } from "vitest";

import { appManifestParse } from "./appManifestParse.js";

describe("appManifestParse", () => {
    it("parses frontmatter fields and uses the entire body as system prompt", () => {
        const manifest = appManifestParse(
            [
                "---",
                "name: github-reviewer",
                "title: GitHub Reviewer",
                "description: Reviews pull requests",
                "model: gpt-4.1-mini",
                "---",
                "",
                "Use concise, actionable review comments.",
                "",
                "Focus on correctness, tests, and security."
            ].join("\n")
        );

        expect(manifest).toEqual({
            name: "github-reviewer",
            title: "GitHub Reviewer",
            description: "Reviews pull requests",
            model: "gpt-4.1-mini",
            systemPrompt: [
                "Use concise, actionable review comments.",
                "",
                "Focus on correctness, tests, and security."
            ].join("\n")
        });
    });

    it("throws when required frontmatter fields are missing", () => {
        const content = ["---", "name: missing-description", "title: Missing description", "---", "", "prompt"].join(
            "\n"
        );

        expect(() => appManifestParse(content)).toThrow(
            "APP.md frontmatter must include name, title, and description."
        );
    });

    it("throws when body system prompt is missing", () => {
        const content = [
            "---",
            "name: github-reviewer",
            "title: GitHub Reviewer",
            "description: Reviews pull requests",
            "---"
        ].join("\n");

        expect(() => appManifestParse(content)).toThrow(
            "APP.md must include a non-empty markdown body for the system prompt."
        );
    });

    it("throws on malformed yaml", () => {
        const content = ["---", "name: github-reviewer", "title: [not closed", "---"].join("\n");

        expect(() => appManifestParse(content)).toThrow("Invalid APP.md frontmatter.");
    });
});
