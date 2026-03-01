import type { TaskActiveSummary } from "./tasksTypes";

/**
 * Builds a display subtitle from a task's trigger configuration.
 * Shows cron schedules and webhook trigger count.
 *
 * Expects: task has at least one trigger (API guarantees this for active tasks).
 */
export function tasksSubtitle(task: TaskActiveSummary): string {
    const parts: string[] = [];

    for (const cron of task.triggers.cron) {
        const tz = cron.timezone !== "UTC" ? ` (${cron.timezone})` : "";
        parts.push(`${cron.schedule}${tz}`);
    }

    const webhookCount = task.triggers.webhook.length;
    if (webhookCount > 0) {
        parts.push(webhookCount === 1 ? "1 webhook" : `${webhookCount} webhooks`);
    }

    return parts.join(" · ");
}
