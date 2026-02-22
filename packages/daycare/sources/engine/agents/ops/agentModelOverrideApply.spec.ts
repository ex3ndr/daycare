import { describe, expect, it } from "vitest";
import type { ProviderSettings } from "../../../settings.js";
import { agentModelOverrideApply } from "./agentModelOverrideApply.js";
import type { AgentModelOverride } from "./agentTypes.js";

const baseProviders: ProviderSettings[] = [{ id: "anthropic", enabled: true, model: "claude-sonnet-4-20250514" }];

describe("agentModelOverrideApply", () => {
    it("returns providers unchanged when override is null", () => {
        const result = agentModelOverrideApply(baseProviders, null, "anthropic");
        expect(result).toBe(baseProviders);
    });

    it("returns providers unchanged when override is undefined", () => {
        const result = agentModelOverrideApply(baseProviders, undefined, "anthropic");
        expect(result).toBe(baseProviders);
    });

    it("overrides model with direct model name", () => {
        const override: AgentModelOverride = { type: "model", value: "claude-opus-4-20250514" };
        const result = agentModelOverrideApply(baseProviders, override, "anthropic");
        expect(result).toHaveLength(1);
        expect(result[0]!.model).toBe("claude-opus-4-20250514");
        expect(result[0]!.id).toBe("anthropic");
    });

    it("does not mutate original providers array", () => {
        const override: AgentModelOverride = { type: "model", value: "custom-model" };
        agentModelOverrideApply(baseProviders, override, "anthropic");
        expect(baseProviders[0]!.model).toBe("claude-sonnet-4-20250514");
    });

    it("returns providers unchanged when provider not found", () => {
        const override: AgentModelOverride = { type: "model", value: "custom-model" };
        const result = agentModelOverrideApply(baseProviders, override, "nonexistent");
        expect(result).toEqual(baseProviders);
    });

    it("falls back to first provider when providerId is null", () => {
        const override: AgentModelOverride = { type: "model", value: "custom-model" };
        const result = agentModelOverrideApply(baseProviders, override, null);
        expect(result[0]!.model).toBe("custom-model");
    });

    it("returns providers unchanged for selector when provider has no model catalog", () => {
        const override: AgentModelOverride = { type: "selector", value: "big" };
        // openai-compatible has no model catalog in provider definitions
        const providers: ProviderSettings[] = [{ id: "openai-compatible", enabled: true, model: "some-model" }];
        const result = agentModelOverrideApply(providers, override, "openai-compatible");
        expect(result[0]!.model).toBe("some-model");
    });
});
