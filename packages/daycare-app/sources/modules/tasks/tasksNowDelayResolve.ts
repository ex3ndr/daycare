const SECOND_MS = 1_000;
const MINUTE_MS = 60_000;
const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;

/**
 * Resolves the next refresh delay for live task timing labels.
 * Expects: nextRunAts contains resolved unix timestamps or nulls for visible triggers.
 */
export function tasksNowDelayResolve(nextRunAts: Array<number | null>, now: number): number {
    const nextRunAt = nextRunAts.reduce<number | null>((current, candidate) => {
        if (typeof candidate !== "number") {
            return current;
        }
        if (current === null || candidate < current) {
            return candidate;
        }
        return current;
    }, null);

    if (nextRunAt === null) {
        return boundaryDelayResolve(now, HOUR_MS);
    }

    const deltaMs = Math.max(0, nextRunAt - now);
    if (deltaMs <= MINUTE_MS) {
        return boundaryDelayResolve(now, SECOND_MS);
    }
    if (deltaMs <= DAY_MS) {
        return boundaryDelayResolve(now, MINUTE_MS);
    }
    return boundaryDelayResolve(now, HOUR_MS);
}

function boundaryDelayResolve(now: number, stepMs: number): number {
    const remainder = now % stepMs;
    if (remainder === 0) {
        return stepMs;
    }
    return stepMs - remainder;
}
