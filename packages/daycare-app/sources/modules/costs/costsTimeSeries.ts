import type { CostsTimeBucket, TokenStatsRow } from "./costsTypes";

const HOUR_MS = 60 * 60 * 1000;

/**
 * Aggregates token stats rows into hourly cost buckets for chart rendering.
 * Fills gaps with zero-cost buckets to produce a continuous series.
 * Returns buckets sorted chronologically.
 */
export function costsTimeSeries(rows: TokenStatsRow[], from: number, to: number): CostsTimeBucket[] {
    const startHour = Math.floor(from / HOUR_MS) * HOUR_MS;
    const endHour = Math.floor(to / HOUR_MS) * HOUR_MS;
    const buckets = new Map<number, number>();
    for (const row of rows) {
        const current = buckets.get(row.hourStart) ?? 0;
        buckets.set(row.hourStart, current + row.cost);
    }
    const result: CostsTimeBucket[] = [];
    for (let hour = startHour; hour <= endHour; hour += HOUR_MS) {
        result.push({ timestamp: hour, cost: buckets.get(hour) ?? 0 });
    }
    return result;
}
