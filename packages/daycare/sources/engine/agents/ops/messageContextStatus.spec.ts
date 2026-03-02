import { describe, expect, it } from "vitest";
import { messageContextStatus } from "./messageContextStatus.js";

describe("messageContextStatus", () => {
    it("returns fallback when no history available", () => {
        const result = messageContextStatus({ usedTokens: null, contextLimit: 200_000 });
        expect(result).toBe("📊 Context: no message history yet. Send a message first.");
    });

    it("renders progress bar and estimate note", () => {
        const result = messageContextStatus({
            usedTokens: 50_000,
            contextLimit: 200_000
        });
        expect(result).toContain("📊 Context: 50k / 200k tokens (25%)");
        expect(result).toContain("[█████░░░░░░░░░░░░░░░]");
        expect(result).toContain("Estimate based on session messages.");
    });

    it("floors decimal token estimates", () => {
        const result = messageContextStatus({
            usedTokens: 13_140.9,
            contextLimit: 200_000
        });
        expect(result).toContain("📊 Context: 13k / 200k tokens (7%)");
    });

    it("caps utilization at 100%", () => {
        const result = messageContextStatus({
            usedTokens: 250_000,
            contextLimit: 200_000
        });
        expect(result).toContain("(100%)");
        expect(result).toContain("[████████████████████]");
    });

    it("handles small token counts without k suffix", () => {
        const result = messageContextStatus({
            usedTokens: 500,
            contextLimit: 200_000
        });
        expect(result).toContain("📊 Context: 500 / 200k tokens (0%)");
    });
});
