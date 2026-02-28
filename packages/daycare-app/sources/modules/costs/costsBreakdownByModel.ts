import type { CostsModelBreakdown, TokenStatsRow } from "./costsTypes";

/**
 * Groups token stats rows by model, computing total cost and row count per model.
 * Returns items sorted by cost descending.
 */
export function costsBreakdownByModel(rows: TokenStatsRow[]): CostsModelBreakdown[] {
    const map = new Map<string, { cost: number; rows: number }>();
    for (const row of rows) {
        const entry = map.get(row.model) ?? { cost: 0, rows: 0 };
        entry.cost += row.cost;
        entry.rows += 1;
        map.set(row.model, entry);
    }
    return [...map.entries()]
        .map(([model, data]) => ({ model, ...data }))
        .sort((a, b) => b.cost - a.cost);
}
