import type { CostsPeriod } from "./costsTypes";

const HOUR_MS = 60 * 60 * 1000;
const PERIOD_MS: Record<CostsPeriod, number> = {
    "24h": 24 * HOUR_MS,
    "7d": 7 * 24 * HOUR_MS,
    "30d": 30 * 24 * HOUR_MS
};

/**
 * Resolves a CostsPeriod label to { from, to } unix timestamps.
 * Expects: period is a valid CostsPeriod key.
 */
export function costsPeriodRange(period: CostsPeriod): { from: number; to: number } {
    const to = Date.now();
    const from = to - PERIOD_MS[period];
    return { from, to };
}
