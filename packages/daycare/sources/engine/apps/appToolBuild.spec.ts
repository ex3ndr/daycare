import { describe, expect, it } from "vitest";
import { appToolBuild } from "./appToolBuild.js";
import type { AppDescriptor } from "./appTypes.js";

describe("appToolBuild", () => {
    it("formats tool metadata from app descriptor", () => {
        const app: AppDescriptor = {
            id: "github-reviewer",
            path: "/workspace/apps/github-reviewer",
            manifest: {
                name: "github-reviewer",
                title: "GitHub Reviewer",
                description: "Reviews pull requests",
                systemPrompt: "You are a focused PR review assistant."
            },
            permissions: {
                sourceIntent: "Review pull requests safely.",
                rules: { allow: [], deny: [] }
            }
        };

        const definition = appToolBuild(app);
        expect(definition.tool.name).toBe("app_github_reviewer");
        expect(definition.tool.description).toBe("Reviews pull requests");
        expect(definition.tool.parameters.type).toBe("object");
        expect(definition.tool.parameters.required).toEqual(["prompt"]);
        expect(definition.tool.parameters.properties).toMatchObject({
            wait: { type: "boolean" }
        });
    });
});
