import { describe, expect, it, vi } from "vitest";
import type { SpeechGenerationProvider } from "./speech/types.js";
import { SpeechGenerationRegistry } from "./speechGenerationRegistry.js";

function providerBuild(id: string): SpeechGenerationProvider {
    return {
        id,
        label: id,
        generate: vi.fn(async () => ({ files: [] }))
    };
}

describe("SpeechGenerationRegistry", () => {
    it("registers providers and lists them", () => {
        const registry = new SpeechGenerationRegistry();
        const providerA = providerBuild("provider-a");
        const providerB = providerBuild("provider-b");

        registry.register("plugin-a", providerA);
        registry.register("plugin-b", providerB);

        expect(registry.get("provider-a")).toEqual(
            expect.objectContaining({
                id: "provider-a",
                label: "provider-a"
            })
        );
        expect(registry.list()).toHaveLength(2);
    });

    it("unregisters individual providers", () => {
        const registry = new SpeechGenerationRegistry();
        registry.register("plugin-a", providerBuild("provider-1"));

        registry.unregister("provider-1");

        expect(registry.get("provider-1")).toBeNull();
        expect(registry.list()).toEqual([]);
    });

    it("unregisters providers by plugin id", () => {
        const registry = new SpeechGenerationRegistry();
        registry.register("plugin-a", providerBuild("provider-1"));
        registry.register("plugin-a", providerBuild("provider-2"));
        registry.register("plugin-b", providerBuild("provider-3"));

        registry.unregisterByPlugin("plugin-a");

        expect(registry.get("provider-1")).toBeNull();
        expect(registry.get("provider-2")).toBeNull();
        expect(registry.get("provider-3")).toEqual(
            expect.objectContaining({
                id: "provider-3",
                label: "provider-3"
            })
        );
    });
});
