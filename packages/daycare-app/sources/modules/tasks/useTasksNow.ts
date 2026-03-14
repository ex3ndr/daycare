import * as React from "react";
import { tasksNowDelayResolve } from "./tasksNowDelayResolve";
import type { CronTriggerSummary, TaskDetailCronTrigger } from "./tasksTypes";

type TaskCronLikeTrigger =
    | Pick<CronTriggerSummary, "schedule" | "timezone" | "enabled">
    | Pick<TaskDetailCronTrigger, "schedule" | "timezone" | "enabled">;

/**
 * Returns a live unix timestamp for task timing UIs.
 * Expects: triggers are the cron triggers currently visible in the active screen.
 */
export function useTasksNow(triggers: TaskCronLikeTrigger[]): number {
    const [now, setNow] = React.useState(() => Date.now());

    React.useEffect(() => {
        const delayMs = tasksNowDelayResolve(triggers, now);
        const timer = setTimeout(() => {
            setNow(Date.now());
        }, delayMs);

        return () => {
            clearTimeout(timer);
        };
    }, [triggers, now]);

    return now;
}
