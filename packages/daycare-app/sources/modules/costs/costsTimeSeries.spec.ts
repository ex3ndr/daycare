import { describe, expect, it } from "vitest";
import { costsTimeSeries } from "./costsTimeSeries";
import type { TokenStatsRow } from "./costsTypes";

const HOUR_MS = 60 * 60 * 1000;

const row = (hourStart: number, cost: number): TokenStatsRow => ({
    hourStart,
    userId: "u1",
    agentId: "a1",
    model: "m1",
    input: 100,
    output: 50,
    cacheRead: 0,
    cacheWrite: 0,
    cost
});

describe("costsTimeSeries", () => {
    it("returns empty buckets for empty rows", () => {
        const from = 0;
        const to = 2 * HOUR_MS;
        const result = costsTimeSeries([], from, to);
        expect(result).toHaveLength(3);
        expect(result.every((b) => b.cost === 0)).toBe(true);
    });

    it("fills gaps with zero-cost buckets", () => {
        const from = 0;
        const to = 3 * HOUR_MS;
        const result = costsTimeSeries([row(HOUR_MS, 0.05)], from, to);
        expect(result).toHaveLength(4);
        expect(result[0].cost).toBe(0);
        expect(result[1].cost).toBeCloseTo(0.05);
        expect(result[2].cost).toBe(0);
    });

    it("aggregates multiple rows in the same hour", () => {
        const from = 0;
        const to = HOUR_MS;
        const result = costsTimeSeries(
            [row(0, 0.01), row(0, 0.02), row(HOUR_MS, 0.05)],
            from,
            to
        );
        expect(result).toHaveLength(2);
        expect(result[0].cost).toBeCloseTo(0.03);
        expect(result[1].cost).toBeCloseTo(0.05);
    });
});
