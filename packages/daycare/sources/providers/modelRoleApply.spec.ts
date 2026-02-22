import { describe, expect, it } from "vitest";
import type { ProviderSettings } from "../settings.js";
import { modelRoleApply } from "./modelRoleApply.js";

const providers: ProviderSettings[] = [
    { id: "anthropic", model: "claude-sonnet-4-20250514" },
    { id: "openai", model: "gpt-4o" }
];

describe("modelRoleApply", () => {
    it("overrides model and moves provider to front", () => {
        const result = modelRoleApply(providers, "openai/gpt-4o-mini");
        expect(result.providerId).toBe("openai");
        expect(result.providers[0]).toEqual({ id: "openai", model: "gpt-4o-mini" });
        expect(result.providers[1]).toEqual({ id: "anthropic", model: "claude-sonnet-4-20250514" });
    });

    it("keeps order when target is already first", () => {
        const result = modelRoleApply(providers, "anthropic/claude-haiku-3.5");
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
        const result = modelRoleApply(providers, "groq/llama-3");
        expect(result.providerId).toBeNull();
        expect(result.providers).toBe(providers);
    });

    it("does not mutate original provider objects", () => {
        const original = [{ id: "openai", model: "gpt-4o" }];
        modelRoleApply(original, "openai/gpt-4o-mini");
        expect(original[0]!.model).toBe("gpt-4o");
    });
});
