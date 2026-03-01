import { describe, expect, it } from "vitest";

import { ImageGenerationRegistry } from "../engine/modules/imageGenerationRegistry.js";
import { InferenceRegistry } from "../engine/modules/inferenceRegistry.js";
import { getLogger } from "../log.js";
import { createPiAiProviderDefinition } from "./pi-ai.js";
import type { ProviderContext } from "./types.js";

const TEST_PROVIDER_ID = "openai";
const TEST_MODEL_ID = "gpt-4.1";

describe("createPiAiProviderDefinition", () => {
    it("uses explicit model id when provided", async () => {
        const inferenceRegistry = new InferenceRegistry();
        const definition = createPiAiProviderDefinition({
            id: TEST_PROVIDER_ID,
            name: "OpenAI",
            description: "OpenAI inference provider.",
            auth: "none",
            models: [{ id: TEST_MODEL_ID, name: "GPT-4.1", size: "normal" }]
        });
        const instance = await definition.create(contextBuild(inferenceRegistry));
        await instance.load?.();

        const provider = inferenceRegistry.get(TEST_PROVIDER_ID);
        if (!provider) {
            throw new Error("Expected inference provider registration");
        }

        const client = await provider.createClient({
            model: TEST_MODEL_ID,
            auth: {} as ProviderContext["auth"],
            logger: getLogger("providers.pi-ai.test")
        });

        expect(client.modelId).toBe(TEST_MODEL_ID);
    });

    it("throws on unknown explicit model id instead of silently falling back", async () => {
        const inferenceRegistry = new InferenceRegistry();
        const definition = createPiAiProviderDefinition({
            id: TEST_PROVIDER_ID,
            name: "OpenAI",
            description: "OpenAI inference provider.",
            auth: "none",
            models: [{ id: TEST_MODEL_ID, name: "GPT-4.1", size: "normal" }]
        });
        const instance = await definition.create(contextBuild(inferenceRegistry));
        await instance.load?.();

        const provider = inferenceRegistry.get(TEST_PROVIDER_ID);
        if (!provider) {
            throw new Error("Expected inference provider registration");
        }

        await expect(
            provider.createClient({
                model: "unknown-model-id",
                auth: {} as ProviderContext["auth"],
                logger: getLogger("providers.pi-ai.test")
            })
        ).rejects.toThrow("Unknown openai model: unknown-model-id");
    });
});

function contextBuild(inferenceRegistry: InferenceRegistry): ProviderContext {
    return {
        settings: { id: TEST_PROVIDER_ID },
        auth: {} as ProviderContext["auth"],
        fileStore: {} as ProviderContext["fileStore"],
        inferenceRegistry,
        imageRegistry: new ImageGenerationRegistry(),
        logger: getLogger("providers.pi-ai.test")
    };
}
