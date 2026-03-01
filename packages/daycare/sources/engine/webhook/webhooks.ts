import { createId } from "@paralleldrive/cuid2";
import type { Context } from "@/types";
import { getLogger } from "../../log.js";
import type { Storage } from "../../storage/storage.js";
import type { AgentSystem } from "../agents/agentSystem.js";
import { contextForUser } from "../agents/context.js";
import { TOPO_EVENT_TYPES, TOPO_SOURCE_WEBHOOKS, topographyObservationEmit } from "../observations/topographyEvents.js";
import type { WebhookDefinition } from "./webhookTypes.js";

const logger = getLogger("webhook.facade");

export type WebhooksOptions = {
    storage: Storage;
    agentSystem: AgentSystem;
};

/**
 * Coordinates webhook triggers for engine runtime.
 * Expects: task records and webhook records share the same user scope.
 */
export class Webhooks {
    private readonly storage: Storage;
    private readonly agentSystem: AgentSystem;

    constructor(options: WebhooksOptions) {
        this.storage = options.storage;
        this.agentSystem = options.agentSystem;
    }

    stop(): void {
        // Webhooks are request-driven and have no scheduler state to stop.
    }

    async listTasks(): Promise<WebhookDefinition[]> {
        return this.storage.webhookTasks.findAll();
    }

    async addTrigger(
        ctx: Context,
        input: {
            taskId: string;
            id?: string;
            agentId?: string;
        }
    ): Promise<WebhookDefinition> {
        const task = await this.storage.tasks.findById(ctx, input.taskId);
        if (!task) {
            throw new Error(`Task not found: ${input.taskId}`);
        }

        const userId = ctx.userId.trim();
        if (!userId) {
            throw new Error("Webhook userId is required.");
        }

        const triggerId = input.id?.trim() || createId();
        const existing = await this.storage.webhookTasks.findById(triggerId);
        if (existing) {
            if (existing.userId !== userId) {
                throw new Error(`Webhook trigger belongs to another user: ${triggerId}`);
            }
            return existing;
        }

        const now = Date.now();
        const created: WebhookDefinition = {
            id: triggerId,
            taskId: task.id,
            userId,
            agentId: input.agentId?.trim() || null,
            lastRunAt: null,
            createdAt: now,
            updatedAt: now
        };
        await this.storage.webhookTasks.create(created);
        const routeTemplate = "/v1/webhooks/:token";
        await topographyObservationEmit(this.storage.observationLog, {
            userId,
            type: TOPO_EVENT_TYPES.WEBHOOK_ADDED,
            source: TOPO_SOURCE_WEBHOOKS,
            message: `Webhook added: ${task.title}`,
            details: `Webhook trigger ${created.id} added for task ${created.taskId}, route template "${routeTemplate}"`,
            data: {
                webhookId: created.id,
                taskId: created.taskId,
                userId,
                name: task.title,
                routeTemplate
            },
            scopeIds: [userId]
        });
        return created;
    }

    async listTriggersForTask(ctx: Context, taskId: string): Promise<WebhookDefinition[]> {
        return this.storage.webhookTasks.findManyByTaskId(ctx, taskId);
    }

    async deleteTriggersForTask(ctx: Context, taskId: string): Promise<number> {
        const triggers = await this.storage.webhookTasks.findManyByTaskId(ctx, taskId);
        let removed = 0;
        for (const trigger of triggers) {
            if (await this.deleteTrigger(ctx, trigger.id)) {
                removed += 1;
            }
        }
        return removed;
    }

    async deleteTrigger(ctx: Context, triggerId: string): Promise<boolean> {
        const existing = await this.storage.webhookTasks.findById(triggerId);
        if (!existing || existing.userId !== ctx.userId.trim()) {
            return false;
        }

        const deleted = await this.storage.webhookTasks.delete(triggerId);
        if (deleted) {
            const task = await this.storage.tasks.findById(ctx, existing.taskId);
            const name = task?.title ?? existing.taskId;
            await topographyObservationEmit(this.storage.observationLog, {
                userId: ctx.userId,
                type: TOPO_EVENT_TYPES.WEBHOOK_DELETED,
                source: TOPO_SOURCE_WEBHOOKS,
                message: `Webhook deleted: ${name}`,
                details: `Webhook trigger ${existing.id} deleted for task ${existing.taskId}`,
                data: {
                    webhookId: existing.id,
                    taskId: existing.taskId,
                    userId: existing.userId,
                    name
                },
                scopeIds: [ctx.userId]
            });
            await this.taskDeleteIfOrphan(ctx, existing.taskId);
        }
        return deleted;
    }

    async trigger(webhookId: string, data?: unknown): Promise<void> {
        const normalizedId = webhookId.trim();
        if (!normalizedId) {
            throw new Error("Webhook trigger id is required.");
        }

        const trigger = await this.storage.webhookTasks.findById(normalizedId);
        if (!trigger) {
            throw new Error(`Webhook trigger not found: ${normalizedId}`);
        }

        const ctx = contextForUser({ userId: trigger.userId });
        const task = await this.storage.tasks.findById(ctx, trigger.taskId);
        if (!task) {
            throw new Error(`Webhook trigger ${normalizedId} references missing task: ${trigger.taskId}`);
        }

        const target = trigger.agentId
            ? { agentId: trigger.agentId }
            : { descriptor: { type: "task" as const, id: trigger.taskId } };
        const text = webhookPromptBuild(trigger, task.title, data);
        const messageContext = webhookMessageContextBuild(data);
        const result = await this.agentSystem.postAndAwait(ctx, target, {
            type: "system_message",
            text,
            code: [task.code],
            origin: "webhook",
            execute: true,
            ...(messageContext ? { context: messageContext } : {})
        });
        if (result.type !== "system_message") {
            throw new Error(`Unexpected webhook execution result type: ${result.type}`);
        }
        if (result.responseError) {
            const output = result.executionErrorText?.trim() ?? result.responseText?.trim();
            if (output && output.length > 0) {
                throw new Error(output);
            }
            throw new Error(`Webhook trigger failed: ${normalizedId}`);
        }
        await this.storage.webhookTasks.recordRun(trigger.id, Date.now());

        logger.info({ triggerId: trigger.id, taskId: task.id }, "event: Webhook trigger executed");
    }

    private async taskDeleteIfOrphan(ctx: Context, taskId: string): Promise<void> {
        const [cronTriggers, webhookTriggers] = await Promise.all([
            this.storage.cronTasks.findManyByTaskId(ctx, taskId),
            this.storage.webhookTasks.findManyByTaskId(ctx, taskId)
        ]);
        if (cronTriggers.length > 0 || webhookTriggers.length > 0) {
            return;
        }
        await this.storage.tasks.delete(ctx, taskId);
    }
}

function webhookPromptBuild(trigger: WebhookDefinition, taskTitle: string, data?: unknown): string {
    const lines = ["[webhook]", `triggerId: ${trigger.id}`, `taskId: ${trigger.taskId}`, `taskTitle: ${taskTitle}`];
    if (data !== undefined) {
        lines.push(`payload: ${jsonStringifySafe(data)}`);
    }
    return lines.join("\n");
}

function webhookMessageContextBuild(data?: unknown): { enrichments: Array<{ key: string; value: string }> } | null {
    if (data === undefined) {
        return null;
    }
    return {
        enrichments: [
            {
                key: "webhook_payload",
                value: jsonStringifySafe(data)
            }
        ]
    };
}

function jsonStringifySafe(data: unknown): string {
    try {
        return JSON.stringify(data);
    } catch {
        return String(data);
    }
}
