import { describe, expect, it } from "vitest";
import { messageContextStatus } from "./messageContextStatus.js";

describe("messageContextStatus", () => {
    it("returns fallback when no tokens available", () => {
        const result = messageContextStatus({ tokens: null, contextLimit: 200_000 });
        expect(result).toBe("📊 Context: no token data yet. Send a message first.");
    });

    it("renders progress bar and stats", () => {
        const result = messageContextStatus({
            tokens: {
                provider: "openai",
                model: "gpt-4o",
                size: { input: 50_000, output: 2_000, cacheRead: 0, cacheWrite: 0, total: 52_000 }
            },
            contextLimit: 200_000
        });
        // used = input + cacheRead + cacheWrite = 50k
        expect(result).toContain("📊 Context: 50k / 200k tokens (25%)");
        expect(result).toContain("[█████░░░░░░░░░░░░░░░]");
        expect(result).toContain("Provider: openai/gpt-4o");
        expect(result).toContain("Input: 50,000");
        expect(result).toContain("Output: 2,000");
    });

    it("includes cached tokens in context usage", () => {
        const result = messageContextStatus({
            tokens: {
                provider: "anthropic",
                model: "claude-opus-4-5",
                size: { input: 399, output: 20, cacheRead: 12_741, cacheWrite: 0, total: 13_160 }
            },
            contextLimit: 200_000
        });
        // used = 399 + 12_741 + 0 = 13_140
        expect(result).toContain("📊 Context: 13k / 200k tokens (7%)");
        expect(result).toContain("Cache read: 12,741");
    });

    it("caps utilization at 100%", () => {
        const result = messageContextStatus({
            tokens: {
                provider: "anthropic",
                model: "claude-3",
                size: { input: 250_000, output: 1_000, cacheRead: 0, cacheWrite: 0, total: 251_000 }
            },
            contextLimit: 200_000
        });
        expect(result).toContain("(100%)");
        expect(result).toContain("[████████████████████]");
    });

    it("handles small token counts without k suffix", () => {
        const result = messageContextStatus({
            tokens: {
                provider: "test",
                model: "small",
                size: { input: 500, output: 100, cacheRead: 0, cacheWrite: 0, total: 600 }
            },
            contextLimit: 200_000
        });
        expect(result).toContain("📊 Context: 500 / 200k tokens (0%)");
    });
});
