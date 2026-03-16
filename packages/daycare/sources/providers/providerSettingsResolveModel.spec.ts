import { describe, expect, it } from "vitest";

import { providerSettingsResolveModel } from "./providerSettingsResolveModel.js";

describe("providerSettingsResolveModel", () => {
    it("keeps an explicit model unchanged", () => {
        expect(providerSettingsResolveModel({ id: "anthropic", model: "claude-opus-4-6" })).toEqual({
            id: "anthropic",
            model: "claude-opus-4-6"
        });
    });

    it("resolves the default curated model for catalog-backed providers", () => {
        expect(providerSettingsResolveModel({ id: "anthropic" })).toEqual({
            id: "anthropic",
            model: "claude-opus-4-6"
        });
    });

    it("uses openai-compatible modelId from provider options", () => {
        expect(
            providerSettingsResolveModel({
                id: "openai-compatible",
                options: {
                    modelId: "custom-model"
                }
            })
        ).toEqual({
            id: "openai-compatible",
            options: {
                modelId: "custom-model"
            },
            model: "custom-model"
        });
    });

    it("uses Zen's configured default model instead of the first catalog entry", () => {
        expect(providerSettingsResolveModel({ id: "zen" })).toEqual({
            id: "zen",
            model: "gpt-5.4"
        });
    });
});
