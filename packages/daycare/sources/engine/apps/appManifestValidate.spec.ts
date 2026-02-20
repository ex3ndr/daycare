import { describe, expect, it } from "vitest";
import { appManifestValidate } from "./appManifestValidate.js";
import type { AppManifest } from "./appTypes.js";

function baseManifest(): AppManifest {
    return {
        name: "github-reviewer",
        title: "GitHub Reviewer",
        description: "Reviews pull requests",
        systemPrompt: "You are a focused PR review assistant."
    };
}

describe("appManifestValidate", () => {
    it("accepts valid manifests", () => {
        const validated = appManifestValidate(baseManifest());

        expect(validated.name).toBe("github-reviewer");
        expect(validated.title).toBe("GitHub Reviewer");
        expect(validated.description).toBe("Reviews pull requests");
        expect(validated.systemPrompt).toBe("You are a focused PR review assistant.");
    });

    it("rejects missing required fields", () => {
        const manifest = baseManifest();
        manifest.systemPrompt = "   ";

        expect(() => appManifestValidate(manifest)).toThrow(
            "App manifest requires name, title, description, and systemPrompt."
        );
    });

    it("rejects non username-style names", () => {
        const manifest = baseManifest();
        manifest.name = "GitHub Reviewer";

        expect(() => appManifestValidate(manifest)).toThrow(
            "App name must be username-style lowercase with optional dash or underscore separators."
        );
    });
});
