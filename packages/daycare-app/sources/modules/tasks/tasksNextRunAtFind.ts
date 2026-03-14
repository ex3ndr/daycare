import { tasksCronNextRunAtResolve } from "./tasksCronNextRunAtResolve";
import type { CronTriggerSummary } from "./tasksTypes";

/**
 * Finds the earliest scheduled next cron fire time from a task's triggers.
 * Expects: trigger schedules use the same cron subset accepted by tasksCronNextRunAtResolve().
 */
export function tasksNextRunAtFind(triggers: CronTriggerSummary[], fromAt?: number): number | null {
    let nextRunAt: number | null = null;
    for (const trigger of triggers) {
        const candidate = tasksCronNextRunAtResolve({
            schedule: trigger.schedule,
            timezone: trigger.timezone,
            enabled: trigger.enabled,
            fromAt
        });
        if (typeof candidate !== "number") {
            continue;
        }
        if (nextRunAt === null || candidate < nextRunAt) {
            nextRunAt = candidate;
        }
    }
    return nextRunAt;
}
