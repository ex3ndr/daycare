import type { CronTriggerSummary, WebhookTriggerSummary } from "./tasksTypes";

/**
 * Builds a display subtitle from a task's trigger lists.
 * Shows cron schedules and webhook trigger count.
 */
export function tasksSubtitle(cron: CronTriggerSummary[], webhook: WebhookTriggerSummary[]): string {
    const parts: string[] = [];

    for (const trigger of cron) {
        const tz = trigger.timezone !== "UTC" ? ` (${trigger.timezone})` : "";
        parts.push(`${trigger.schedule}${tz}`);
    }

    if (webhook.length > 0) {
        parts.push(webhook.length === 1 ? "1 webhook" : `${webhook.length} webhooks`);
    }

    return parts.length > 0 ? parts.join(" · ") : "No triggers";
}
