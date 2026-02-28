import { describe, expect, it } from "vitest";
import { costsBreakdownByModel } from "./costsBreakdownByModel";
import type { TokenStatsRow } from "./costsTypes";

const row = (model: string, cost: number): TokenStatsRow => ({
    hourStart: 0,
    userId: "u1",
    agentId: "a1",
    model,
    input: 100,
    output: 50,
    cacheRead: 0,
    cacheWrite: 0,
    cost
});

describe("costsBreakdownByModel", () => {
    it("returns empty for no rows", () => {
        expect(costsBreakdownByModel([])).toEqual([]);
    });

    it("groups by model and sorts by cost descending", () => {
        const result = costsBreakdownByModel([
            row("anthropic/opus", 0.1),
            row("anthropic/haiku", 0.02),
            row("anthropic/opus", 0.05)
        ]);
        expect(result).toHaveLength(2);
        expect(result[0].model).toBe("anthropic/opus");
        expect(result[0].cost).toBeCloseTo(0.15);
        expect(result[1].model).toBe("anthropic/haiku");
    });
});
