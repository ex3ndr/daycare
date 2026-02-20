import type { AssistantMessage, UserMessage } from "@mariozechner/pi-ai";
import { describe, expect, it } from "vitest";

import { messageExtractText } from "./messageExtractText.js";

describe("messageExtractText", () => {
    it("joins assistant text blocks", () => {
        const message: AssistantMessage = {
            role: "assistant",
            content: [
                { type: "text", text: "hello" },
                { type: "text", text: "world" }
            ],
            api: "openai-responses",
            provider: "openai",
            model: "test-model",
            usage: {
                input: 0,
                output: 0,
                cacheRead: 0,
                cacheWrite: 0,
                totalTokens: 0,
                cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 }
            },
            stopReason: "stop",
            timestamp: Date.now()
        };

        expect(messageExtractText(message)).toBe("hello\nworld");
    });

    it("returns null for non-assistant messages", () => {
        const message: UserMessage = {
            role: "user",
            content: "hello",
            timestamp: Date.now()
        };

        expect(messageExtractText(message)).toBeNull();
    });
});
