import { describe, expect, it } from "vitest";
import { configResolve } from "../../../../config/configResolve.js";
import { getProviderDefinition } from "../../../../providers/catalog.js";
import { providerModelSelectBySize } from "../../../../providers/providerModelSelectBySize.js";
import type { ProviderSettings } from "../../../../settings.js";
import { ConfigModule } from "../../../config/configModule.js";
import { inferenceResolveProviders } from "./inferenceResolveProviders.js";

describe("inferenceResolveProviders", () => {
    it("returns default providers when model is omitted", () => {
        const input: ProviderSettings[] = [
            { id: "openai", enabled: true, model: "gpt-4o-mini" },
            { id: "anthropic", enabled: true, model: "claude-sonnet-4-5" }
        ];
        const config = configModuleBuild(input);

        const result = inferenceResolveProviders(config);

        expect(result).toEqual(input);
        expect(result[0]).not.toBe(input[0]);
        expect(result[1]).not.toBe(input[1]);
    });

    it("resolves size selectors for each provider", () => {
        const input: ProviderSettings[] = [
            { id: "openai", enabled: true, model: "gpt-4o-mini" },
            { id: "anthropic", enabled: true, model: "claude-sonnet-4-5" }
        ];
        const config = configModuleBuild(input);

        const result = inferenceResolveProviders(config, "SMALL");
        const expectedOpenAiModel =
            providerModelSelectBySize(getProviderDefinition("openai")?.models ?? [], "small") ?? input[0]?.model;
        const expectedAnthropicModel =
            providerModelSelectBySize(getProviderDefinition("anthropic")?.models ?? [], "small") ?? input[1]?.model;

        expect(result).toEqual([
            { ...input[0], model: expectedOpenAiModel },
            { ...input[1], model: expectedAnthropicModel }
        ]);
    });

    it("overrides only the first provider for a specific model name", () => {
        const input: ProviderSettings[] = [
            { id: "openai", enabled: true, model: "gpt-4o-mini" },
            { id: "anthropic", enabled: true, model: "claude-sonnet-4-5" }
        ];
        const config = configModuleBuild(input);

        const result = inferenceResolveProviders(config, "custom-model-id");

        expect(result).toEqual([{ ...input[0], model: "custom-model-id" }, { ...input[1] }]);
    });

    it("resolves configured custom flavor to provider/model mapping", () => {
        const input: ProviderSettings[] = [
            { id: "openai", enabled: true, model: "gpt-4o-mini" },
            { id: "anthropic", enabled: true, model: "claude-sonnet-4-5" }
        ];
        const config = configModuleBuild(input, {
            coding: {
                model: "anthropic/claude-opus-4-5",
                description: "High reasoning for difficult code work"
            }
        });

        const result = inferenceResolveProviders(config, "coding");

        expect(result).toEqual([{ ...input[1], model: "claude-opus-4-5" }, { ...input[0] }]);
    });

    it("keeps defaults for custom flavor mapped to inactive provider", () => {
        const input: ProviderSettings[] = [{ id: "anthropic", enabled: true, model: "claude-sonnet-4-5" }];
        const config = configModuleBuild(input, {
            coding: {
                model: "openai/gpt-5-mini",
                description: "Fast coding model"
            }
        });

        const result = inferenceResolveProviders(config, "coding");

        expect(result).toEqual([{ ...input[0] }]);
    });
});

function configModuleBuild(
    providers: ProviderSettings[],
    modelFlavors?: Record<string, { model: string; description: string }>
): ConfigModule {
    const config = configResolve(
        {
            engine: { dataDir: "/tmp/daycare-tests" },
            providers,
            modelFlavors
        },
        "/tmp/daycare-tests/settings.json"
    );
    return new ConfigModule(config);
}
