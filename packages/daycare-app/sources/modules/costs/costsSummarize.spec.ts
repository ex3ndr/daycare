import { describe, expect, it } from "vitest";
import { costsSummarize } from "./costsSummarize";
import type { TokenStatsRow } from "./costsTypes";

const row = (overrides: Partial<TokenStatsRow> = {}): TokenStatsRow => ({
    hourStart: 0,
    userId: "u1",
    agentId: "a1",
    model: "anthropic/claude-opus-4-6",
    input: 100,
    output: 50,
    cacheRead: 10,
    cacheWrite: 5,
    cost: 0.01,
    ...overrides
});

describe("costsSummarize", () => {
    it("returns zeros for empty array", () => {
        const result = costsSummarize([]);
        expect(result).toEqual({
            totalCost: 0,
            totalInput: 0,
            totalOutput: 0,
            totalCacheRead: 0,
            totalCacheWrite: 0
        });
    });

    it("sums a single row", () => {
        const result = costsSummarize([row()]);
        expect(result.totalCost).toBe(0.01);
        expect(result.totalInput).toBe(100);
        expect(result.totalOutput).toBe(50);
        expect(result.totalCacheRead).toBe(10);
        expect(result.totalCacheWrite).toBe(5);
    });

    it("sums multiple rows", () => {
        const result = costsSummarize([row(), row({ cost: 0.02, input: 200 })]);
        expect(result.totalCost).toBeCloseTo(0.03);
        expect(result.totalInput).toBe(300);
    });
});
