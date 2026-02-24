import { describe, expect, it, vi } from "vitest";
import type { MediaAnalysisProvider } from "./media-analysis/types.js";
import { MediaAnalysisRegistry } from "./mediaAnalysisRegistry.js";

function providerBuild(id: string, supportedTypes: MediaAnalysisProvider["supportedTypes"]): MediaAnalysisProvider {
    return {
        id,
        label: id,
        supportedTypes,
        analyze: vi.fn(async () => ({ text: "ok" }))
    };
}

describe("MediaAnalysisRegistry", () => {
    it("registers providers and lists them", () => {
        const registry = new MediaAnalysisRegistry();
        const imageProvider = providerBuild("image-provider", ["image"]);
        const videoProvider = providerBuild("video-provider", ["video"]);

        registry.register("plugin-a", imageProvider);
        registry.register("plugin-b", videoProvider);

        expect(registry.get("image-provider")).toEqual(
            expect.objectContaining({
                id: "image-provider",
                label: "image-provider",
                supportedTypes: ["image"]
            })
        );
        expect(registry.list()).toHaveLength(2);
    });

    it("unregisters individual providers", () => {
        const registry = new MediaAnalysisRegistry();
        registry.register("plugin-a", providerBuild("provider-1", ["image"]));

        registry.unregister("provider-1");

        expect(registry.get("provider-1")).toBeNull();
        expect(registry.list()).toEqual([]);
    });

    it("unregisters providers by plugin id", () => {
        const registry = new MediaAnalysisRegistry();
        registry.register("plugin-a", providerBuild("provider-1", ["image"]));
        registry.register("plugin-a", providerBuild("provider-2", ["audio"]));
        registry.register("plugin-b", providerBuild("provider-3", ["video"]));

        registry.unregisterByPlugin("plugin-a");

        expect(registry.get("provider-1")).toBeNull();
        expect(registry.get("provider-2")).toBeNull();
        expect(registry.get("provider-3")).toEqual(
            expect.objectContaining({
                id: "provider-3",
                label: "provider-3",
                supportedTypes: ["video"]
            })
        );
    });

    it("filters providers by media type", () => {
        const registry = new MediaAnalysisRegistry();
        const mixed = providerBuild("mixed", ["image", "audio"]);
        const pdfOnly = providerBuild("pdf", ["pdf"]);
        registry.register("plugin-a", mixed);
        registry.register("plugin-b", pdfOnly);

        expect(registry.findByMediaType("image")).toEqual([expect.objectContaining({ id: "mixed" })]);
        expect(registry.findByMediaType("audio")).toEqual([expect.objectContaining({ id: "mixed" })]);
        expect(registry.findByMediaType("pdf")).toEqual([expect.objectContaining({ id: "pdf" })]);
        expect(registry.findByMediaType("video")).toEqual([]);
    });
});
