import { describe, expect, it, vi } from "vitest";

import type { AuthStore } from "../auth/store.js";
import { ImageGenerationRegistry } from "../engine/modules/imageGenerationRegistry.js";
import { InferenceRegistry } from "../engine/modules/inferenceRegistry.js";
import { getLogger } from "../log.js";
import { getProviderDefinition } from "./catalog.js";
import { zenProvider, zenProviderModels } from "./zen.js";

describe("zen provider", () => {
    it("hardcodes the current Zen model ids", () => {
        expect(zenProviderModels.map((model) => model.id)).toEqual([
            "claude-opus-4-6",
            "claude-opus-4-5",
            "claude-opus-4-1",
            "claude-sonnet-4-6",
            "claude-sonnet-4-5",
            "claude-sonnet-4",
            "claude-3-5-haiku",
            "claude-haiku-4-5",
            "gemini-3.1-pro",
            "gemini-3-pro",
            "gemini-3-flash",
            "gpt-5.3-codex",
            "gpt-5.2",
            "gpt-5.2-codex",
            "gpt-5.1",
            "gpt-5.1-codex-max",
            "gpt-5.1-codex",
            "gpt-5.1-codex-mini",
            "gpt-5",
            "gpt-5-codex",
            "gpt-5-nano",
            "glm-5",
            "glm-4.7",
            "glm-4.6",
            "minimax-m2.5",
            "minimax-m2.5-free",
            "minimax-m2.1",
            "minimax-m2.1-free",
            "kimi-k2.5",
            "kimi-k2.5-free",
            "kimi-k2",
            "kimi-k2-thinking",
            "trinity-large-preview-free",
            "big-pickle",
            "glm-5-free"
        ]);
    });

    it("is available in the provider catalog", () => {
        expect(getProviderDefinition("zen")?.name).toBe("Zen");
    });

    it("registers inference and creates a client for Zen models", async () => {
        const auth = {
            getApiKey: vi.fn(async () => "test-key")
        } as unknown as AuthStore;
        const inferenceRegistry = new InferenceRegistry();

        const instance = await Promise.resolve(
            zenProvider.create({
                settings: {
                    id: "zen",
                    enabled: true,
                    model: "gpt-5.3-codex"
                },
                auth,
                fileStore: {} as never,
                inferenceRegistry,
                imageRegistry: new ImageGenerationRegistry(),
                logger: getLogger("providers.zen.spec")
            })
        );

        await instance.load?.();

        const registered = inferenceRegistry.get("zen");
        expect(registered).not.toBeNull();

        const client = await registered!.createClient({
            auth,
            model: "gpt-5.3-codex",
            logger: getLogger("providers.zen.client")
        });

        expect(client.modelId).toBe("gpt-5.3-codex");
        expect(auth.getApiKey).toHaveBeenCalledWith("zen");

        await instance.unload?.();
        expect(inferenceRegistry.get("zen")).toBeNull();
    });

    it("onboarding stores API key and sets default model", async () => {
        const setApiKey = vi.fn(async () => undefined);
        const promptInput = vi.fn(async () => "zen-token");

        const result = await zenProvider.onboarding!({
            id: "zen",
            auth: {
                getApiKey: async () => null,
                setApiKey
            } as unknown as AuthStore,
            prompt: {
                input: promptInput,
                confirm: async () => true,
                select: async () => null
            },
            note: () => undefined
        });

        expect(promptInput).toHaveBeenCalled();
        expect(setApiKey).toHaveBeenCalledWith("zen", "zen-token");
        expect(result).toEqual({
            settings: {
                model: "gpt-5.2-codex"
            }
        });
    });
});
