import type { TaskActiveSummary, TaskStatus } from "./tasksTypes";

/**
 * Derives display status for a task based on execution history.
 * Returns "ok" if the task has been executed at least once, "warning" otherwise.
 *
 * Expects: task is an active task from the API (has at least one trigger).
 */
export function tasksStatus(task: TaskActiveSummary): TaskStatus {
    if (task.lastExecutedAt !== null) {
        return "ok";
    }
    return "warning";
}
