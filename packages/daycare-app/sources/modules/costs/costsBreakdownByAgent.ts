import type { CostsAgentBreakdown, TokenStatsRow } from "./costsTypes";

/**
 * Groups token stats rows by agentId, computing total cost and row count per agent.
 * Returns items sorted by cost descending.
 */
export function costsBreakdownByAgent(rows: TokenStatsRow[]): CostsAgentBreakdown[] {
    const map = new Map<string, { cost: number; rows: number }>();
    for (const row of rows) {
        const entry = map.get(row.agentId) ?? { cost: 0, rows: 0 };
        entry.cost += row.cost;
        entry.rows += 1;
        map.set(row.agentId, entry);
    }
    return [...map.entries()].map(([agentId, data]) => ({ agentId, ...data })).sort((a, b) => b.cost - a.cost);
}
