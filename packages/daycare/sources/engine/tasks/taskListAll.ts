import type { Context } from "@/types";
import type { Storage } from "../../storage/storage.js";

export type TaskSummary = {
    id: string;
    title: string;
    description: string | null;
    createdAt: number;
    updatedAt: number;
    lastExecutedAt: number | null;
};

export type CronTriggerSummary = {
    id: string;
    taskId: string;
    schedule: string;
    timezone: string;
    agentId: string | null;
    enabled: boolean;
    lastExecutedAt: number | null;
};

export type WebhookTriggerSummary = {
    id: string;
    taskId: string;
    agentId: string | null;
    lastExecutedAt: number | null;
};

export type TaskListAllResult = {
    tasks: TaskSummary[];
    triggers: {
        cron: CronTriggerSummary[];
        webhook: WebhookTriggerSummary[];
    };
};

/**
 * Lists all tasks for a user with triggers as a separate collection.
 * Unlike taskListActive, includes tasks without triggers and shows all cron triggers (even disabled).
 *
 * Expects: ctx.userId is normalized and storage repositories are initialized.
 */
export async function taskListAll(options: { storage: Storage; ctx: Context }): Promise<TaskListAllResult> {
    const [tasks, cronTriggers, webhookTriggers] = await Promise.all([
        options.storage.tasks.findMany(options.ctx),
        options.storage.cronTasks.findMany(options.ctx, { includeDisabled: true }),
        options.storage.webhookTasks.findMany(options.ctx)
    ]);

    // Collect lastRunAt per task from all triggers
    const lastRunByTask = new Map<string, number>();
    for (const trigger of cronTriggers) {
        if (typeof trigger.lastRunAt === "number") {
            const prev = lastRunByTask.get(trigger.taskId);
            if (prev === undefined || trigger.lastRunAt > prev) {
                lastRunByTask.set(trigger.taskId, trigger.lastRunAt);
            }
        }
    }
    for (const trigger of webhookTriggers) {
        if (typeof trigger.lastRunAt === "number") {
            const prev = lastRunByTask.get(trigger.taskId);
            if (prev === undefined || trigger.lastRunAt > prev) {
                lastRunByTask.set(trigger.taskId, trigger.lastRunAt);
            }
        }
    }

    const taskSummaries: TaskSummary[] = tasks
        .sort((a, b) => a.updatedAt - b.updatedAt)
        .map((task) => ({
            id: task.id,
            title: task.title,
            description: task.description,
            createdAt: task.createdAt,
            updatedAt: task.updatedAt,
            lastExecutedAt: lastRunByTask.get(task.id) ?? null
        }));

    const cronSummaries: CronTriggerSummary[] = cronTriggers
        .slice()
        .sort((a, b) => a.id.localeCompare(b.id))
        .map((trigger) => ({
            id: trigger.id,
            taskId: trigger.taskId,
            schedule: trigger.schedule,
            timezone: trigger.timezone,
            agentId: trigger.agentId,
            enabled: trigger.enabled,
            lastExecutedAt: trigger.lastRunAt
        }));

    const webhookSummaries: WebhookTriggerSummary[] = webhookTriggers
        .slice()
        .sort((a, b) => a.id.localeCompare(b.id))
        .map((trigger) => ({
            id: trigger.id,
            taskId: trigger.taskId,
            agentId: trigger.agentId,
            lastExecutedAt: trigger.lastRunAt
        }));

    return {
        tasks: taskSummaries,
        triggers: {
            cron: cronSummaries,
            webhook: webhookSummaries
        }
    };
}
