import type { Context } from "@/types";
import type { TaskDbRecord } from "../../storage/databaseTypes.js";
import type { Storage } from "../../storage/storage.js";

export type TaskActiveCronTrigger = {
    id: string;
    schedule: string;
    timezone: string;
    agentId: string | null;
    lastExecutedAt: number | null;
};

export type TaskActiveWebhookTrigger = {
    id: string;
    agentId: string | null;
    lastExecutedAt: number | null;
};

export type TaskActiveSummary = {
    id: string;
    title: string;
    description: string | null;
    createdAt: number;
    updatedAt: number;
    lastExecutedAt: number | null;
    triggers: {
        cron: TaskActiveCronTrigger[];
        webhook: TaskActiveWebhookTrigger[];
    };
};

type TaskActiveMutable = Omit<TaskActiveSummary, "lastExecutedAt"> & {
    lastExecutedCandidates: number[];
};

/**
 * Lists active tasks for a user with all active triggers and execution timestamps.
 * Returns tasks that currently have at least one active trigger attached.
 *
 * Expects: ctx.userId is normalized and storage repositories are initialized.
 */
export async function taskListActive(options: { storage: Storage; ctx: Context }): Promise<TaskActiveSummary[]> {
    const [tasks, cronTriggers, webhookTriggers] = await Promise.all([
        options.storage.tasks.findMany(options.ctx),
        options.storage.cronTasks.findMany(options.ctx),
        options.storage.webhookTasks.findMany(options.ctx)
    ]);

    const taskById = new Map(tasks.map((task) => [task.id, task] as const));
    const activeById = new Map<string, TaskActiveMutable>();

    for (const trigger of cronTriggers) {
        const active = taskActiveEnsure(activeById, taskById, trigger.taskId);
        if (!active) {
            continue;
        }
        active.triggers.cron.push({
            id: trigger.id,
            schedule: trigger.schedule,
            timezone: trigger.timezone,
            agentId: trigger.agentId,
            lastExecutedAt: trigger.lastRunAt
        });
        if (typeof trigger.lastRunAt === "number") {
            active.lastExecutedCandidates.push(trigger.lastRunAt);
        }
    }

    for (const trigger of webhookTriggers) {
        const active = taskActiveEnsure(activeById, taskById, trigger.taskId);
        if (!active) {
            continue;
        }
        active.triggers.webhook.push({
            id: trigger.id,
            agentId: trigger.agentId,
            lastExecutedAt: trigger.lastRunAt
        });
        if (typeof trigger.lastRunAt === "number") {
            active.lastExecutedCandidates.push(trigger.lastRunAt);
        }
    }

    return Array.from(activeById.values())
        .sort((left, right) => left.updatedAt - right.updatedAt)
        .map((task) => ({
            id: task.id,
            title: task.title,
            description: task.description,
            createdAt: task.createdAt,
            updatedAt: task.updatedAt,
            lastExecutedAt: taskLastExecutedAtResolve(task.lastExecutedCandidates),
            triggers: {
                cron: task.triggers.cron.slice().sort((left, right) => left.id.localeCompare(right.id)),
                webhook: task.triggers.webhook.slice().sort((left, right) => left.id.localeCompare(right.id))
            }
        }));
}

function taskActiveEnsure(
    activeById: Map<string, TaskActiveMutable>,
    taskById: Map<string, TaskDbRecord>,
    taskId: string
): TaskActiveMutable | null {
    const existing = activeById.get(taskId);
    if (existing) {
        return existing;
    }

    const task = taskById.get(taskId);
    if (!task) {
        return null;
    }

    const active: TaskActiveMutable = {
        id: task.id,
        title: task.title,
        description: task.description,
        createdAt: task.createdAt,
        updatedAt: task.updatedAt,
        lastExecutedCandidates: [],
        triggers: {
            cron: [],
            webhook: []
        }
    };
    activeById.set(taskId, active);
    return active;
}

function taskLastExecutedAtResolve(candidates: number[]): number | null {
    if (candidates.length === 0) {
        return null;
    }
    return Math.max(...candidates);
}
