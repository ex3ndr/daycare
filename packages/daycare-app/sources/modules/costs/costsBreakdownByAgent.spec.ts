import { describe, expect, it } from "vitest";
import { costsBreakdownByAgent } from "./costsBreakdownByAgent";
import type { TokenStatsRow } from "./costsTypes";

const row = (agentId: string, cost: number): TokenStatsRow => ({
    hourStart: 0,
    userId: "u1",
    agentId,
    model: "m1",
    input: 100,
    output: 50,
    cacheRead: 0,
    cacheWrite: 0,
    cost
});

describe("costsBreakdownByAgent", () => {
    it("returns empty for no rows", () => {
        expect(costsBreakdownByAgent([])).toEqual([]);
    });

    it("groups by agent and sorts by cost descending", () => {
        const result = costsBreakdownByAgent([row("scout", 0.01), row("builder", 0.05), row("scout", 0.02)]);
        expect(result).toHaveLength(2);
        expect(result[0].agentId).toBe("builder");
        expect(result[0].cost).toBeCloseTo(0.05);
        expect(result[0].rows).toBe(1);
        expect(result[1].agentId).toBe("scout");
        expect(result[1].cost).toBeCloseTo(0.03);
        expect(result[1].rows).toBe(2);
    });

    it("counts rows per agent", () => {
        const result = costsBreakdownByAgent([row("a", 0.1), row("a", 0.1), row("a", 0.1)]);
        expect(result[0].rows).toBe(3);
    });
});
