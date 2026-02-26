import type { AssistantMessage } from "@mariozechner/pi-ai";
import { describe, expect, it } from "vitest";
import { inferenceOutputTokensValidate } from "./inferenceOutputTokensValidate.js";

describe("inferenceOutputTokensValidate", () => {
    it("throws for zero output tokens", () => {
        expect(() => inferenceOutputTokensValidate(assistantMessageCreate(0))).toThrow(
            "Inference error: provider returned zero output tokens."
        );
    });

    it("accepts positive output tokens", () => {
        expect(() => inferenceOutputTokensValidate(assistantMessageCreate(3))).not.toThrow();
    });

    it("accepts missing token usage", () => {
        const message = {
            ...assistantMessageCreate(3),
            usage: undefined
        } as unknown as AssistantMessage;

        expect(() => inferenceOutputTokensValidate(message)).not.toThrow();
    });
});

function assistantMessageCreate(outputTokens: number): AssistantMessage {
    return {
        role: "assistant",
        content: [{ type: "text", text: "ok" }],
        api: "openai-responses",
        provider: "openai",
        model: "gpt-test",
        usage: {
            input: 1,
            output: outputTokens,
            cacheRead: 0,
            cacheWrite: 0,
            totalTokens: 1 + outputTokens,
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
    };
}
