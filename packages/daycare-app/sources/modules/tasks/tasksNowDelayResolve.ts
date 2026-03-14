import { tasksCronNextRunAtResolve } from "./tasksCronNextRunAtResolve";
import type { CronTriggerSummary, TaskDetailCronTrigger } from "./tasksTypes";

const SECOND_MS = 1_000;
const MINUTE_MS = 60_000;
const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;

type TaskCronLikeTrigger =
    | Pick<CronTriggerSummary, "schedule" | "timezone" | "enabled">
    | Pick<TaskDetailCronTrigger, "schedule" | "timezone" | "enabled">;

/**
 * Resolves the next refresh delay for live task timing labels.
 * Expects: triggers are cron-like objects with schedule, timezone, and enabled fields.
 */
export function tasksNowDelayResolve(triggers: TaskCronLikeTrigger[], now: number): number {
    const nextRunAt = tasksNextRunAtResolve(triggers, now);
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

function tasksNextRunAtResolve(triggers: TaskCronLikeTrigger[], now: number): number | null {
    let nextRunAt: number | null = null;
    for (const trigger of triggers) {
        const candidate = tasksCronNextRunAtResolve({ ...trigger, fromAt: now });
        if (typeof candidate !== "number") {
            continue;
        }
        if (nextRunAt === null || candidate < nextRunAt) {
            nextRunAt = candidate;
        }
    }
    return nextRunAt;
}

function boundaryDelayResolve(now: number, stepMs: number): number {
    const remainder = now % stepMs;
    if (remainder === 0) {
        return stepMs;
    }
    return stepMs - remainder;
}
