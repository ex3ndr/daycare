import type { Context } from "@/types";
import { getLogger } from "../../log.js";
import type { Storage } from "../../storage/storage.js";
import type { AgentSystem } from "../agents/agentSystem.js";
import { agentPathTask } from "../agents/ops/agentPathBuild.js";
import type { ConfigModule } from "../config/configModule.js";
import type { EngineEventBus } from "../ipc/events.js";
import { TOPO_EVENT_TYPES, TOPO_SOURCE_CRONS, topographyObservationEmit } from "../observations/topographyEvents.js";
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
                    : { path: agentPathTask(task.userId, task.taskId) };
                logger.debug(
                    `event: CronScheduler.onTask triggered triggerId=${task.triggerId} taskId=${task.taskId} agentId=${task.agentId ?? `task:${task.taskId}`}`
                );

                const text = cronTaskPromptBuild(task);
                this.agentSystem.taskExecutions.dispatch({
                    userId: task.userId,
                    source: "cron",
                    taskId: task.taskId,
                    taskVersion: task.taskVersion ?? null,
                    target,
                    creationConfig: task.agentId
                        ? undefined
                        : {
                              kind: "task",
                              name: task.taskName
                          },
                    text,
                    parameters: task.inputs ?? undefined,
                    context: messageContext
                });
            },
            onError: async (error, triggerId) => {
                logger.warn({ triggerId, error }, "error: Cron task failed");
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
        await topographyObservationEmit(this.storage.observationLog, {
            userId: ctx.userId,
            type: TOPO_EVENT_TYPES.CRON_ADDED,
            source: TOPO_SOURCE_CRONS,
            message: `Cron added: ${task.id}`,
            details: `Cron trigger ${task.id} added for task ${task.taskId}, schedule "${task.schedule}" tz ${task.timezone}`,
            data: {
                cronId: task.id,
                taskId: task.taskId,
                userId: task.userId,
                schedule: task.schedule,
                timezone: task.timezone
            },
            scopeIds: [ctx.userId]
        });
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
            await topographyObservationEmit(this.storage.observationLog, {
                userId: ctx.userId,
                type: TOPO_EVENT_TYPES.CRON_DELETED,
                source: TOPO_SOURCE_CRONS,
                message: `Cron deleted: ${existing.id}`,
                details: `Cron trigger ${existing.id} deleted for task ${existing.taskId}`,
                data: {
                    cronId: existing.id,
                    taskId: existing.taskId,
                    userId: existing.userId
                },
                scopeIds: [ctx.userId]
            });
        }
        return deleted;
    }

    async enableTask(ctx: Context, taskId: string): Promise<boolean> {
        return this.cronEnabledSet(ctx, taskId, true);
    }

    async disableTask(ctx: Context, taskId: string): Promise<boolean> {
        return this.cronEnabledSet(ctx, taskId, false);
    }

    async loadTask(taskId: string) {
        return this.scheduler.loadTask(taskId);
    }

    async triggerTask(triggerId: string): Promise<void> {
        await this.scheduler.triggerTaskNow(triggerId);
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

    private async cronEnabledSet(ctx: Context, taskId: string, enabled: boolean): Promise<boolean> {
        const userId = ctx.userId.trim();
        if (!userId) {
            return false;
        }
        const existing = await this.storage.cronTasks.findById(taskId);
        if (!existing || existing.userId !== userId) {
            return false;
        }
        if (existing.enabled === enabled) {
            return true;
        }
        await this.storage.cronTasks.update(taskId, {
            enabled,
            updatedAt: Date.now()
        });
        await this.scheduler.reload();
        await topographyObservationEmit(this.storage.observationLog, {
            userId,
            type: enabled ? TOPO_EVENT_TYPES.CRON_ENABLED : TOPO_EVENT_TYPES.CRON_DISABLED,
            source: TOPO_SOURCE_CRONS,
            message: `${enabled ? "Cron enabled" : "Cron disabled"}: ${existing.id}`,
            details: `Cron trigger ${existing.id} ${enabled ? "enabled" : "disabled"} for task ${existing.taskId}`,
            data: {
                cronId: existing.id,
                taskId: existing.taskId,
                userId: existing.userId
            },
            scopeIds: [userId]
        });
        return true;
    }
}

function cronTaskPromptBuild(task: { triggerId: string; taskId: string; taskName: string; timezone: string }): string {
    const text = [
        "[cron]",
        `triggerId: ${task.triggerId}`,
        `taskId: ${task.taskId}`,
        `taskName: ${task.taskName}`,
        `timezone: ${task.timezone}`
    ].join("\n");
    return text;
}
