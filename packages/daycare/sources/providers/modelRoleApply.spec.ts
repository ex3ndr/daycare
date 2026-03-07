import { describe, expect, it } from "vitest";
import type { ProviderSettings } from "../settings.js";
import { modelRoleApply } from "./modelRoleApply.js";

const providers: ProviderSettings[] = [
    { id: "anthropic", model: "claude-sonnet-4-20250514" },
    { id: "openai", model: "gpt-4o" }
];

describe("modelRoleApply", () => {
    it("overrides model and moves provider to front", () => {
        const result = modelRoleApply(providers, { model: "openai/gpt-4o-mini", reasoning: "medium" });
        expect(result.providerId).toBe("openai");
        expect(result.providers[0]).toEqual({ id: "openai", model: "gpt-4o-mini", reasoning: "medium" });
        expect(result.providers[1]).toEqual({ id: "anthropic", model: "claude-sonnet-4-20250514" });
    });

    it("keeps order when target is already first", () => {
        const result = modelRoleApply(providers, { model: "anthropic/claude-haiku-3.5" });
        expect(result.providerId).toBe("anthropic");
        expect(result.providers[0]).toEqual({ id: "anthropic", model: "claude-haiku-3.5" });
        expect(result.providers[1]).toEqual({ id: "openai", model: "gpt-4o" });
    });

    it("returns original providers when config is undefined", () => {
        const result = modelRoleApply(providers, undefined);
        expect(result.providerId).toBeNull();
        expect(result.providers).toBe(providers);
    });

    it("returns original providers when provider not found", () => {
        const result = modelRoleApply(providers, { model: "groq/llama-3" });
        expect(result.providerId).toBeNull();
        expect(result.providers).toBe(providers);
    });

    it("does not mutate original provider objects", () => {
        const original: ProviderSettings[] = [{ id: "openai", model: "gpt-4o" }];
        modelRoleApply(original, { model: "openai/gpt-4o-mini", reasoning: "high" });
        expect(original[0]!.model).toBe("gpt-4o");
        expect(original[0]!.reasoning).toBeUndefined();
    });

    it("preserves provider reasoning when role selection does not set it", () => {
        const original: ProviderSettings[] = [{ id: "openai", model: "gpt-4o", reasoning: "low" }];
        const result = modelRoleApply(original, { model: "openai/gpt-4o-mini" });
        expect(result.providers[0]).toEqual({ id: "openai", model: "gpt-4o-mini", reasoning: "low" });
    });
});
