import { describe, expect, it } from "vitest";
import type { ProviderSettings } from "../settings.js";
import { modelRoleResolve } from "./modelRoleResolve.js";

const providers: ProviderSettings[] = [
    { id: "anthropic", model: "claude-sonnet-4-20250514" },
    { id: "openai", model: "gpt-4o" }
];

describe("modelRoleResolve", () => {
    it("parses valid provider/model string", () => {
        const result = modelRoleResolve("anthropic/claude-haiku-3.5", providers);
        expect(result).toEqual({ providerId: "anthropic", model: "claude-haiku-3.5" });
    });

    it("handles model names with slashes", () => {
        const result = modelRoleResolve("openai/org/gpt-4o-mini", providers);
        expect(result).toEqual({ providerId: "openai", model: "org/gpt-4o-mini" });
    });

    it("returns null for undefined config", () => {
        expect(modelRoleResolve(undefined, providers)).toBeNull();
    });

    it("returns null for empty string", () => {
        expect(modelRoleResolve("", providers)).toBeNull();
    });

    it("returns null for missing slash", () => {
        expect(modelRoleResolve("anthropic", providers)).toBeNull();
    });

    it("returns null for empty provider id", () => {
        expect(modelRoleResolve("/gpt-4o", providers)).toBeNull();
    });

    it("returns null for empty model name", () => {
        expect(modelRoleResolve("anthropic/", providers)).toBeNull();
    });

    it("returns null when provider is not in active list", () => {
        expect(modelRoleResolve("groq/llama-3", providers)).toBeNull();
    });
});
