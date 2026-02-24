import { describe, expect, it } from "vitest";
import { mediaPromptDefault } from "./mediaPromptDefault.js";
import type { MediaType } from "./types.js";

describe("mediaPromptDefault", () => {
    it("returns non-empty defaults for each media type", () => {
        const mediaTypes: MediaType[] = ["image", "video", "audio", "pdf"];

        for (const mediaType of mediaTypes) {
            const prompt = mediaPromptDefault(mediaType);
            expect(prompt.trim().length).toBeGreaterThan(0);
        }
    });
});
