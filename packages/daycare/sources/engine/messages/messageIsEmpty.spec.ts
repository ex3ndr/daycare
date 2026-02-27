import { describe, expect, it } from "vitest";

import { messageIsEmpty } from "./messageIsEmpty.js";

describe("messageIsEmpty", () => {
    it("returns true for empty text payloads without files", () => {
        expect(messageIsEmpty({ text: null })).toBe(true);
        expect(messageIsEmpty({ text: "   " })).toBe(true);
        expect(messageIsEmpty({ text: null, rawText: "   " })).toBe(true);
    });

    it("returns false when payload has files", () => {
        expect(
            messageIsEmpty({
                text: null,
                files: [{ id: "f-1", name: "voice.ogg", mimeType: "audio/ogg", size: 1, path: "/tmp/voice.ogg" }]
            })
        ).toBe(false);
    });

    it("returns false for non-empty text", () => {
        expect(messageIsEmpty({ text: "hello" })).toBe(false);
        expect(messageIsEmpty({ text: null, rawText: "hello" })).toBe(false);
    });
});
