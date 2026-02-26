import { describe, expect, it } from "vitest";
import type { ProviderSettings } from "../../../settings.js";
import { agentModelOverrideApply } from "./agentModelOverrideApply.js";
import type { AgentModelOverride } from "./agentTypes.js";

const baseProviders: ProviderSettings[] = [{ id: "anthropic", enabled: true, model: "claude-sonnet-4-20250514" }];

describe("agentModelOverrideApply", () => {
    it("returns providers unchanged when override is null", () => {
        const result = agentModelOverrideApply(baseProviders, null, "anthropic", undefined);
        expect(result).toBe(baseProviders);
    });

    it("returns providers unchanged when override is undefined", () => {
        const result = agentModelOverrideApply(baseProviders, undefined, "anthropic", undefined);
        expect(result).toBe(baseProviders);
    });

    it("resolves large selector from provider catalog", () => {
        const override: AgentModelOverride = { type: "selector", value: "large" };
        const result = agentModelOverrideApply(baseProviders, override, "anthropic", undefined);
        expect(result).toHaveLength(1);
        expect(result[0]!.model).toBe("claude-opus-4-5");
        expect(result[0]!.id).toBe("anthropic");
    });

    it("does not mutate original providers array", () => {
        const override: AgentModelOverride = { type: "selector", value: "normal" };
        agentModelOverrideApply(baseProviders, override, "anthropic", undefined);
        expect(baseProviders[0]!.model).toBe("claude-sonnet-4-20250514");
    });

    it("returns providers unchanged when provider not found", () => {
        const override: AgentModelOverride = { type: "selector", value: "normal" };
        const result = agentModelOverrideApply(baseProviders, override, "nonexistent", undefined);
        expect(result).toEqual(baseProviders);
    });

    it("falls back to first provider when providerId is null", () => {
        const override: AgentModelOverride = { type: "selector", value: "large" };
        const result = agentModelOverrideApply(baseProviders, override, null, undefined);
        expect(result[0]!.model).toBe("claude-opus-4-5");
    });

    it("returns providers unchanged for selector when provider has no model catalog", () => {
        const override: AgentModelOverride = { type: "selector", value: "large" };
        // openai-compatible has no model catalog in provider definitions
        const providers: ProviderSettings[] = [{ id: "openai-compatible", enabled: true, model: "some-model" }];
        const result = agentModelOverrideApply(providers, override, "openai-compatible", undefined);
        expect(result[0]!.model).toBe("some-model");
    });

    it("applies configured selector override when present", () => {
        const override: AgentModelOverride = { type: "selector", value: "small" };
        const providers: ProviderSettings[] = [
            { id: "anthropic", enabled: true, model: "claude-sonnet-4-5" },
            { id: "openai", enabled: true, model: "gpt-5" }
        ];

        const result = agentModelOverrideApply(providers, override, "anthropic", { small: "openai/gpt-5-mini" });

        expect(result[0]).toMatchObject({ id: "openai", model: "gpt-5-mini" });
    });

    it("ignores configured selector override when provider is not active", () => {
        const override: AgentModelOverride = { type: "selector", value: "small" };

        const result = agentModelOverrideApply(baseProviders, override, "anthropic", { small: "openai/gpt-5-mini" });

        expect(result[0]).toMatchObject({ id: "anthropic", model: "claude-haiku-4-5" });
    });
});
