import { describe, expect, it } from "vitest";

import { messageEmptyIs } from "./messageEmptyIs.js";

describe("messageEmptyIs", () => {
    it("returns true for empty text payloads without files", () => {
        expect(messageEmptyIs({ text: null })).toBe(true);
        expect(messageEmptyIs({ text: "   " })).toBe(true);
        expect(messageEmptyIs({ text: null, rawText: "   " })).toBe(true);
    });

    it("returns false when payload has files", () => {
        expect(
            messageEmptyIs({
                text: null,
                files: [{ id: "f-1", name: "voice.ogg", mimeType: "audio/ogg", size: 1, path: "/tmp/voice.ogg" }]
            })
        ).toBe(false);
    });

    it("returns false for non-empty text", () => {
        expect(messageEmptyIs({ text: "hello" })).toBe(false);
        expect(messageEmptyIs({ text: null, rawText: "hello" })).toBe(false);
    });
});
