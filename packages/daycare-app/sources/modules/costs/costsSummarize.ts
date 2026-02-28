import type { CostsSummary, TokenStatsRow } from "./costsTypes";

/**
 * Computes aggregate totals from token stats rows.
 * Expects: rows array (may be empty).
 */
export function costsSummarize(rows: TokenStatsRow[]): CostsSummary {
    let totalCost = 0;
    let totalInput = 0;
    let totalOutput = 0;
    let totalCacheRead = 0;
    let totalCacheWrite = 0;
    for (const row of rows) {
        totalCost += row.cost;
        totalInput += row.input;
        totalOutput += row.output;
        totalCacheRead += row.cacheRead;
        totalCacheWrite += row.cacheWrite;
    }
    return { totalCost, totalInput, totalOutput, totalCacheRead, totalCacheWrite };
}
