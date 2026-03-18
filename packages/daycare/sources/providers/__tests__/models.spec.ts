import { getModels, getProviders } from "@mariozechner/pi-ai";
import { describe, expect, it } from "vitest";

import { PROVIDER_MODELS } from "../models.js";

type PiAiProviderId = Parameters<typeof getModels>[0];

function sortIds(ids: string[]): string[] {
    return [...ids].sort((a, b) => a.localeCompare(b));
}

describe("provider model registry", () => {
    it("matches the pi-ai provider/model ids for the curated Daycare subset", () => {
        const piProviders = new Set<string>(getProviders());
        const ourProviders = sortIds(Object.keys(PROVIDER_MODELS));

        for (const provider of ourProviders) {
            expect(piProviders.has(provider)).toBe(true);
        }

        for (const provider of ourProviders) {
            const piIds = sortIds(getModels(provider as PiAiProviderId).map((model) => model.id));
            const ourIds = sortIds(PROVIDER_MODELS[provider as keyof typeof PROVIDER_MODELS].map((model) => model.id));
            expect(ourIds).toEqual(piIds);
        }
    });
});
