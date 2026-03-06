import { describe, expect, it } from "vitest";
import type { SecretSummary } from "@/modules/secrets/secretsTypes";
import { secretPresenceSubtitleBuild } from "./secretPresenceSubtitleBuild";

describe("secretPresenceSubtitleBuild", () => {
    it("includes description and variable names", () => {
        const summary: SecretSummary = {
            name: "openai",
            displayName: "OpenAI",
            description: "Shared model access",
            variableNames: ["OPENAI_API_KEY", "OPENAI_ORG_ID"],
            variableCount: 2
        };

        expect(secretPresenceSubtitleBuild(summary)).toBe(
            "Shared model access\nVariables: OPENAI_API_KEY, OPENAI_ORG_ID"
        );
    });

    it("omits empty descriptions", () => {
        const summary: SecretSummary = {
            name: "openai",
            displayName: "OpenAI",
            description: "   ",
            variableNames: ["OPENAI_API_KEY"],
            variableCount: 1
        };

        expect(secretPresenceSubtitleBuild(summary)).toBe("Variables: OPENAI_API_KEY");
    });

    it("handles empty variable lists without exposing values", () => {
        const summary: SecretSummary = {
            name: "openai",
            displayName: "OpenAI",
            description: "",
            variableNames: [],
            variableCount: 0
        };

        expect(secretPresenceSubtitleBuild(summary)).toBe("Variables: none configured");
    });
});
