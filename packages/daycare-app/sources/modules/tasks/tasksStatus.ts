import type { TaskStatus, TaskSummary } from "./tasksTypes";

/**
 * Derives display status for a task based on execution history.
 * Returns "ok" if the task has been executed at least once, "warning" otherwise.
 */
export function tasksStatus(task: TaskSummary): TaskStatus {
    if (task.lastExecutedAt !== null) {
        return "ok";
    }
    return "warning";
}
