import { tasksCronNextRunAtResolve } from "./tasksCronNextRunAtResolve";
import type { CronTriggerSummary, TaskDetailCronTrigger } from "./tasksTypes";

type TaskCronIdentifiedTrigger =
    | Pick<CronTriggerSummary, "id" | "schedule" | "timezone" | "enabled">
    | Pick<TaskDetailCronTrigger, "id" | "schedule" | "timezone" | "enabled">;

/**
 * Resolves next fire times for a visible trigger set and indexes them by trigger id.
 * Expects: trigger ids are unique within the provided list.
 */
export function tasksNextRunMapResolve(triggers: TaskCronIdentifiedTrigger[], now: number): Map<string, number | null> {
    const nextRunAtById = new Map<string, number | null>();
    for (const trigger of triggers) {
        nextRunAtById.set(trigger.id, tasksCronNextRunAtResolve({ ...trigger, fromAt: now }));
    }
    return nextRunAtById;
}
