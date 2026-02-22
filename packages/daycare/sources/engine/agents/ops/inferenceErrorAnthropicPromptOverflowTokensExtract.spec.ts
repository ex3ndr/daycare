import { describe, expect, it } from "vitest";
import { inferenceErrorAnthropicPromptOverflowTokensExtract } from "./inferenceErrorAnthropicPromptOverflowTokensExtract.js";

describe("inferenceErrorAnthropicPromptOverflowTokensExtract", () => {
    it("extracts prompt token count from overflow message", () => {
        const tokens = inferenceErrorAnthropicPromptOverflowTokensExtract(
            '400 {"type":"error","error":{"type":"invalid_request_error","message":"prompt is too long: 216326 tokens > 200000 maximum"}}'
        );
        expect(tokens).toBe(216_326);
    });

    it("supports token counts with separators", () => {
        const tokens = inferenceErrorAnthropicPromptOverflowTokensExtract(
            "prompt is too long: 216,326 tokens > 200,000 maximum"
        );
        expect(tokens).toBe(216_326);
    });

    it("returns undefined when token count is not present", () => {
        const tokens = inferenceErrorAnthropicPromptOverflowTokensExtract("context overflow");
        expect(tokens).toBeUndefined();
    });
});
