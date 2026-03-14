import * as React from "react";
import { type TasksNextRunCacheEntry, tasksNextRunCacheResolve } from "./tasksNextRunCacheResolve";
import { tasksNowDelayResolve } from "./tasksNowDelayResolve";
import type { CronTriggerSummary, TaskDetailCronTrigger } from "./tasksTypes";

type TaskCronIdentifiedTrigger =
    | Pick<CronTriggerSummary, "id" | "schedule" | "timezone" | "enabled">
    | Pick<TaskDetailCronTrigger, "id" | "schedule" | "timezone" | "enabled">;

/**
 * Returns a live clock plus cached next-fire timestamps for visible cron triggers.
 * Expects: trigger ids are unique within the provided list.
 */
export function useTasksLiveNextRuns(triggers: TaskCronIdentifiedTrigger[]): {
    now: number;
    nextRunAtById: Map<string, number | null>;
} {
    const [now, setNow] = React.useState(() => Date.now());
    const cacheRef = React.useRef<Map<string, TasksNextRunCacheEntry>>(new Map());
    const nextRunAtById = React.useMemo(() => {
        const resolved = tasksNextRunCacheResolve(triggers, cacheRef.current, now);
        cacheRef.current = resolved.cache;
        return resolved.nextRunAtById;
    }, [triggers, now]);
    const nextRunAts = React.useMemo(() => Array.from(nextRunAtById.values()), [nextRunAtById]);

    React.useEffect(() => {
        const delayMs = tasksNowDelayResolve(nextRunAts, now);
        const timer = setTimeout(() => {
            setNow(Date.now());
        }, delayMs);

        return () => {
            clearTimeout(timer);
        };
    }, [nextRunAts, now]);

    return { now, nextRunAtById };
}
