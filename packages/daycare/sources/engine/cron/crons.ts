import type { Context } from "@/types";
import { getLogger } from "../../log.js";
import type { Storage } from "../../storage/storage.js";
import type { AgentSystem } from "../agents/agentSystem.js";
import { contextForUser } from "../agents/context.js";
import type { ConfigModule } from "../config/configModule.js";
import type { EngineEventBus } from "../ipc/events.js";
import type { CronTaskDefinition } from "./cronTypes.js";
import { CronScheduler } from "./ops/cronScheduler.js";

const logger = getLogger("cron.facade");

export type CronsOptions = {
    config: ConfigModule;
    storage: Storage;
    eventBus: EngineEventBus;
    agentSystem: AgentSystem;
};

/**
 * Coordinates cron scheduling for engine runtime.
 * Posts cron task code directly to the agent system.
 */
export class Crons {
    private readonly eventBus: EngineEventBus;
    private readonly agentSystem: AgentSystem;
    private readonly scheduler: CronScheduler;
    private readonly storage: Storage;

    constructor(options: CronsOptions) {
        this.eventBus = options.eventBus;
        this.agentSystem = options.agentSystem;
        this.storage = options.storage;
        this.scheduler = new CronScheduler({
            config: options.config,
            repository: this.storage.cronTasks,
            tasksRepository: this.storage.tasks,
            usersRepository: this.storage.users,
            onTask: async (task, messageContext) => {
                const target = task.agentId
                    ? { agentId: task.agentId }
                    : { descriptor: { type: "task" as const, id: task.taskId } };
                logger.debug(
                    `event: CronScheduler.onTask triggered triggerId=${task.triggerId} taskId=${task.taskId} agentId=${task.agentId ?? `task:${task.taskId}`}`
                );

                const built = cronTaskPromptBuild(task);
                const result = await this.agentSystem.postAndAwait(contextForUser({ userId: task.userId }), target, {
                    type: "system_message",
                    text: built.text,
                    code: built.code,
                    inputs: task.inputs ? [task.inputs] : undefined,
                    inputSchemas: task.inputSchema ? [task.inputSchema] : undefined,
                    origin: "cron",
                    execute: true,
                    context: messageContext
                });
                if (result.type === "system_message" && result.responseError) {
                    throw new Error(
                        `Cron execution failed with code errors for trigger ${task.triggerId} task ${task.taskId}.`
                    );
                }
            },
            onError: async (error, triggerId) => {
                logger.warn({ triggerId, error }, "error: Cron task failed");
                await this.failureMessagePost(triggerId, error);
            },
            onTaskComplete: (task, runAt) => {
                this.eventBus.emit("cron.task.ran", { taskId: task.id, runAt: runAt.toISOString() });
            }
        });
    }

    async start(): Promise<void> {
        await this.scheduler.start();
        this.eventBus.emit("cron.started", { tasks: this.scheduler.listTasks() });
    }

    stop(): void {
        this.scheduler.stop();
    }

    listScheduledTasks() {
        return this.scheduler.listTasks();
    }

    async listTasks() {
        return this.storage.cronTasks.findAll({ includeDisabled: true });
    }

    async addTask(ctx: Context, definition: Omit<CronTaskDefinition, "id" | "userId"> & { id?: string }) {
        const userId = ctx.userId.trim();
        if (!userId) {
            throw new Error("Cron userId is required.");
        }

        const existingTrigger = definition.id ? await this.storage.cronTasks.findById(definition.id) : null;
        if (existingTrigger && existingTrigger.userId !== userId) {
            throw new Error(`Cron task belongs to another user: ${existingTrigger.id}`);
        }

        const taskId = definition.taskId;
        const taskRecord = await this.storage.tasks.findById(ctx, taskId);
        if (!taskRecord) {
            throw new Error(`Task not found: ${taskId}`);
        }

        const task = await this.scheduler.addTask(ctx, {
            ...definition
        });
        this.eventBus.emit("cron.task.added", { task });
        return task;
    }

    async deleteTask(ctx: Context, taskId: string): Promise<boolean> {
        const existing = await this.storage.cronTasks.findById(taskId);
        if (!existing || existing.userId !== ctx.userId.trim()) {
            return false;
        }

        const deleted = await this.scheduler.deleteTask(ctx, taskId);
        if (deleted && existing.taskId) {
            await this.taskDeleteIfOrphan(ctx, existing.taskId);
        }
        return deleted;
    }

    async loadTask(taskId: string) {
        return this.scheduler.loadTask(taskId);
    }

    async addTrigger(
        ctx: Context,
        input: {
            taskId: string;
            schedule: string;
            timezone?: string;
            id?: string;
            agentId?: string;
            enabled?: boolean;
            deleteAfterRun?: boolean;
            parameters?: Record<string, unknown>;
        }
    ) {
        const taskRecord = await this.storage.tasks.findById(ctx, input.taskId);
        if (!taskRecord) {
            throw new Error(`Task not found: ${input.taskId}`);
        }
        return this.addTask(ctx, {
            id: input.id,
            taskId: input.taskId,
            schedule: input.schedule,
            timezone: input.timezone,
            agentId: input.agentId,
            enabled: input.enabled,
            deleteAfterRun: input.deleteAfterRun,
            parameters: input.parameters
        });
    }

    async listTriggersForTask(ctx: Context, taskId: string) {
        return this.storage.cronTasks.findManyByTaskId(ctx, taskId);
    }

    async deleteTriggersForTask(ctx: Context, taskId: string): Promise<number> {
        const triggers = await this.storage.cronTasks.findManyByTaskId(ctx, taskId);
        let removed = 0;
        for (const trigger of triggers) {
            if (await this.deleteTask(ctx, trigger.id)) {
                removed += 1;
            }
        }
        return removed;
    }

    private async failureMessagePost(triggerId: string, error: unknown): Promise<void> {
        const trigger = await this.storage.cronTasks.findById(triggerId);
        if (!trigger) {
            logger.warn({ triggerId }, "error: Failed to report cron failure; trigger not found");
            return;
        }

        const target = trigger.agentId
            ? { agentId: trigger.agentId }
            : { descriptor: { type: "system" as const, tag: "cron" } };
        const text = cronTaskFailurePromptBuild({
            triggerId: trigger.id,
            taskId: trigger.taskId,
            errorText: errorTextBuild(error)
        });

        try {
            await this.agentSystem.post(contextForUser({ userId: trigger.userId }), target, {
                type: "system_message",
                text,
                origin: "cron:failure"
            });
        } catch (reportError) {
            logger.warn(
                { triggerId: trigger.id, taskId: trigger.taskId, reportError },
                "error: Failed to deliver cron failure system message"
            );
        }
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

function cronTaskPromptBuild(task: {
    code: string;
    triggerId: string;
    taskId: string;
    taskName: string;
    timezone: string;
}): {
    text: string;
    code: string[];
} {
    const text = [
        "[cron]",
        `triggerId: ${task.triggerId}`,
        `taskId: ${task.taskId}`,
        `taskName: ${task.taskName}`,
        `timezone: ${task.timezone}`
    ].join("\n");
    return { text, code: [task.code] };
}

function cronTaskFailurePromptBuild(input: { triggerId: string; taskId: string; errorText: string }): string {
    return [
        "[cron_failed]",
        `triggerId: ${input.triggerId}`,
        `taskId: ${input.taskId}`,
        `error: ${input.errorText}`,
        "This cron execution failed. Try to fix the task before the next run.",
        "When you report the outcome, include both triggerId and taskId."
    ].join("\n");
}

function errorTextBuild(error: unknown): string {
    if (error instanceof Error && error.message.trim().length > 0) {
        return error.message.trim();
    }
    if (typeof error === "string" && error.trim().length > 0) {
        return error.trim();
    }
    return "Unknown cron failure.";
}
