import { tasksCronNextRunAtResolve } from "./tasksCronNextRunAtResolve";
import type { CronTriggerSummary, TaskDetailCronTrigger } from "./tasksTypes";

type TaskCronIdentifiedTrigger =
    | Pick<CronTriggerSummary, "id" | "schedule" | "timezone" | "enabled">
    | Pick<TaskDetailCronTrigger, "id" | "schedule" | "timezone" | "enabled">;

export type TasksNextRunCacheEntry = {
    schedule: string;
    timezone: string;
    enabled: boolean;
    nextRunAt: number | null;
};

/**
 * Reuses cached next-fire timestamps until a trigger changes or its cached fire time passes.
 * Expects: cache entries are keyed by trigger id and came from the same trigger model shape.
 */
export function tasksNextRunCacheResolve(
    triggers: TaskCronIdentifiedTrigger[],
    cache: Map<string, TasksNextRunCacheEntry>,
    now: number
): {
    cache: Map<string, TasksNextRunCacheEntry>;
    nextRunAtById: Map<string, number | null>;
} {
    const nextCache = new Map<string, TasksNextRunCacheEntry>();
    const nextRunAtById = new Map<string, number | null>();

    for (const trigger of triggers) {
        const cached = cache.get(trigger.id);
        const nextRunAt =
            cached &&
            cached.schedule === trigger.schedule &&
            cached.timezone === trigger.timezone &&
            cached.enabled === trigger.enabled &&
            (cached.nextRunAt === null || cached.nextRunAt > now)
                ? cached.nextRunAt
                : tasksCronNextRunAtResolve({ ...trigger, fromAt: now });

        nextCache.set(trigger.id, {
            schedule: trigger.schedule,
            timezone: trigger.timezone,
            enabled: trigger.enabled,
            nextRunAt
        });
        nextRunAtById.set(trigger.id, nextRunAt);
    }

    return { cache: nextCache, nextRunAtById };
}
