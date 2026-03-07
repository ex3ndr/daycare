import { describe, expect, it } from "vitest";
import type { ProviderSettings } from "../settings.js";
import { modelRoleResolve } from "./modelRoleResolve.js";

const providers: ProviderSettings[] = [
    { id: "anthropic", model: "claude-sonnet-4-20250514" },
    { id: "openai", model: "gpt-4o" }
];

describe("modelRoleResolve", () => {
    it("parses valid provider/model selection", () => {
        const result = modelRoleResolve({ model: "anthropic/claude-haiku-3.5", reasoning: "medium" }, providers);
        expect(result).toEqual({ providerId: "anthropic", model: "claude-haiku-3.5", reasoning: "medium" });
    });

    it("handles model names with slashes", () => {
        const result = modelRoleResolve({ model: "openai/org/gpt-4o-mini" }, providers);
        expect(result).toEqual({ providerId: "openai", model: "org/gpt-4o-mini" });
    });

    it("returns null for undefined config", () => {
        expect(modelRoleResolve(undefined, providers)).toBeNull();
    });

    it("returns null for empty model string", () => {
        expect(modelRoleResolve({ model: "" }, providers)).toBeNull();
    });

    it("returns null for missing slash", () => {
        expect(modelRoleResolve({ model: "anthropic" }, providers)).toBeNull();
    });

    it("returns null for empty provider id", () => {
        expect(modelRoleResolve({ model: "/gpt-4o" }, providers)).toBeNull();
    });

    it("returns null for empty model name", () => {
        expect(modelRoleResolve({ model: "anthropic/" }, providers)).toBeNull();
    });

    it("returns null when provider is not in active list", () => {
        expect(modelRoleResolve({ model: "groq/llama-3" }, providers)).toBeNull();
    });
});
