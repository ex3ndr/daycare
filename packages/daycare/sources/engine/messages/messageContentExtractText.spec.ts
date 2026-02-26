import { describe, expect, it } from "vitest";
import { messageContentExtractText } from "./messageContentExtractText.js";

describe("messageContentExtractText", () => {
    it("joins assistant text blocks and skips non-text blocks", () => {
        const text = messageContentExtractText([
            { type: "thinking", thinking: "hidden" },
            { type: "text", text: "hello" },
            { type: "toolCall", id: "tool-1", name: "echo", arguments: { text: "x" } },
            { type: "text", text: "world" }
        ]);

        expect(text).toBe("hello\nworld");
    });
});
