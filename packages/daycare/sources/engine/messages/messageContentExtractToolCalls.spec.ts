import { describe, expect, it } from "vitest";
import { messageContentExtractToolCalls } from "./messageContentExtractToolCalls.js";

describe("messageContentExtractToolCalls", () => {
    it("returns only tool calls from assistant content", () => {
        const toolCalls = messageContentExtractToolCalls([
            { type: "text", text: "first" },
            { type: "toolCall", id: "tool-1", name: "echo", arguments: { text: "a" } },
            { type: "thinking", thinking: "internal" },
            { type: "toolCall", id: "tool-2", name: "wait", arguments: { seconds: 1 } }
        ]);

        expect(toolCalls).toEqual([
            { type: "toolCall", id: "tool-1", name: "echo", arguments: { text: "a" } },
            { type: "toolCall", id: "tool-2", name: "wait", arguments: { seconds: 1 } }
        ]);
    });
});
