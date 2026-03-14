import type { TaskSummary } from "./tasksTypes";

/**
 * Returns tasks ordered by earliest next cron fire time, with unscheduled tasks last.
 * Expects: nextRunAtByTask contains earliest resolved next fire times keyed by task id.
 */
export function tasksSortByNextRun(tasks: TaskSummary[], nextRunAtByTask: Map<string, number | null>): TaskSummary[] {
    return tasks.slice().sort((left, right) => {
        const leftNextRunAt = nextRunAtByTask.get(left.id) ?? null;
        const rightNextRunAt = nextRunAtByTask.get(right.id) ?? null;

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
