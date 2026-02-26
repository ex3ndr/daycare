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
            onTask: async (task, messageContext) => {
                const target = task.agentId
                    ? { agentId: task.agentId }
                    : { descriptor: { type: "system" as const, tag: "cron" } };
                logger.debug(
                    `event: CronScheduler.onTask triggered triggerId=${task.triggerId} taskId=${task.taskId} agentId=${task.agentId ?? "system:cron"}`
                );

                const built = cronTaskPromptBuild(task);
                await this.agentSystem.postAndAwait(contextForUser({ userId: task.userId }), target, {
                    type: "system_message",
                    text: built.text,
                    code: built.code,
                    origin: "cron",
                    execute: true,
                    context: messageContext
                });
            },
            onError: async (error, taskId) => {
                logger.warn({ taskId, error }, "error: Cron task failed");
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
            id?: string;
            agentId?: string;
            enabled?: boolean;
            deleteAfterRun?: boolean;
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
            agentId: input.agentId,
            enabled: input.enabled,
            deleteAfterRun: input.deleteAfterRun
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

    private async taskDeleteIfOrphan(ctx: Context, taskId: string): Promise<void> {
        const [cronTriggers, heartbeatTriggers] = await Promise.all([
            this.storage.cronTasks.findManyByTaskId(ctx, taskId),
            this.storage.heartbeatTasks.findManyByTaskId(ctx, taskId)
        ]);
        if (cronTriggers.length > 0 || heartbeatTriggers.length > 0) {
            return;
        }
        await this.storage.tasks.delete(ctx, taskId);
    }
}

function cronTaskPromptBuild(task: { code: string; triggerId: string; taskId: string; taskName: string }): {
    text: string;
    code: string[];
} {
    const text = [
        "[cron]",
        `triggerId: ${task.triggerId}`,
        `taskId: ${task.taskId}`,
        `taskName: ${task.taskName}`
    ].join("\n");
    return { text, code: [task.code] };
}
