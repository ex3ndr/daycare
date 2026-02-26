import { describe, expect, it } from "vitest";
import { messageExtractToolCalls } from "./messageExtractToolCalls.js";

describe("messageExtractToolCalls", () => {
    it("extracts assistant tool-call blocks", () => {
        const calls = messageExtractToolCalls({
            role: "assistant",
            content: [
                { type: "text", text: "Planning" },
                { id: "tool-1", type: "toolCall", name: "run_python", arguments: { code: "'ok'" } }
            ],
            api: "openai-responses",
            provider: "openai",
            model: "gpt-test",
            usage: {
                input: 0,
                output: 0,
                cacheRead: 0,
                cacheWrite: 0,
                totalTokens: 0,
                cost: {
                    input: 0,
                    output: 0,
                    cacheRead: 0,
                    cacheWrite: 0,
                    total: 0
                }
            },
            stopReason: "stop",
            timestamp: Date.now()
        });

        expect(calls).toEqual([{ id: "tool-1", type: "toolCall", name: "run_python", arguments: { code: "'ok'" } }]);
    });

    it("returns empty list for non-assistant messages", () => {
        const calls = messageExtractToolCalls({
            role: "user",
            content: [{ type: "text", text: "Hello" }],
            timestamp: Date.now()
        });

        expect(calls).toEqual([]);
    });
});
