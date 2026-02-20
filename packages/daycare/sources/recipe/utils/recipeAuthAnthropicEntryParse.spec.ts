import { describe, expect, it } from "vitest";

import { recipeAuthAnthropicEntryParse } from "./recipeAuthAnthropicEntryParse.js";

describe("recipeAuthAnthropicEntryParse", () => {
    it("returns oauth credentials without the type field", () => {
        const parsed = recipeAuthAnthropicEntryParse({
            type: "oauth",
            access_token: "token",
            refresh_token: "refresh"
        });

        expect(parsed).toEqual({
            access_token: "token",
            refresh_token: "refresh"
        });
    });

    it("throws when entry is not oauth", () => {
        expect(() => recipeAuthAnthropicEntryParse({ type: "apiKey", apiKey: "x" })).toThrow(
            'Expected anthropic auth entry with type "oauth".'
        );
    });
});
