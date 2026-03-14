import { tasksNextRunAtFind } from "./tasksNextRunAtFind";
import type { CronTriggerSummary, TaskSummary } from "./tasksTypes";

/**
 * Returns tasks ordered by earliest next cron fire time, with unscheduled tasks last.
 * Expects: cronByTask contains the cron triggers for the provided tasks.
 */
export function tasksSortByNextRun(
    tasks: TaskSummary[],
    cronByTask: Map<string, CronTriggerSummary[]>,
    fromAt?: number
): TaskSummary[] {
    return tasks.slice().sort((left, right) => {
        const leftNextRunAt = tasksNextRunAtFind(cronByTask.get(left.id) ?? [], fromAt);
        const rightNextRunAt = tasksNextRunAtFind(cronByTask.get(right.id) ?? [], fromAt);

        if (leftNextRunAt === null && rightNextRunAt === null) {
            return left.title.localeCompare(right.title);
        }
        if (leftNextRunAt === null) {
            return 1;
        }
        if (rightNextRunAt === null) {
            return -1;
        }
        if (leftNextRunAt !== rightNextRunAt) {
            return leftNextRunAt - rightNextRunAt;
        }
        return left.title.localeCompare(right.title);
    });
}
