import type { Context } from "@/types";
import { getLogger } from "../../log.js";
import type { Storage } from "../../storage/storage.js";
import type { AgentSystem } from "../agents/agentSystem.js";
import { contextForUser } from "../agents/context.js";
import type { ConfigModule } from "../config/configModule.js";
import type { EngineEventBus } from "../ipc/events.js";
import type { HeartbeatCreateTaskArgs, HeartbeatDefinition } from "./heartbeatTypes.js";
import { heartbeatPromptBuildBatch } from "./ops/heartbeatPromptBuildBatch.js";
import { HeartbeatScheduler } from "./ops/heartbeatScheduler.js";

const logger = getLogger("heartbeat.facade");

export type HeartbeatsOptions = {
    config: ConfigModule;
    storage: Storage;
    eventBus: EngineEventBus;
    agentSystem: AgentSystem;
    intervalMs?: number;
};

/**
 * Coordinates heartbeat scheduling for engine runtime.
 * Posts heartbeat prompts directly to the agent system.
 */
export class Heartbeats {
    private readonly eventBus: EngineEventBus;
    private readonly agentSystem: AgentSystem;
    private readonly scheduler: HeartbeatScheduler;
    private readonly storage: Storage;

    constructor(options: HeartbeatsOptions) {
        this.eventBus = options.eventBus;
        this.agentSystem = options.agentSystem;
        this.storage = options.storage;
        this.scheduler = new HeartbeatScheduler({
            config: options.config,
            repository: options.storage.heartbeatTasks,
            tasksRepository: options.storage.tasks,
            intervalMs: options.intervalMs,
            onRun: async (tasks) => {
                for (const task of tasks) {
                    const target = { descriptor: { type: "task" as const, id: task.taskId } };
                    const batch = heartbeatPromptBuildBatch([task]);
                    await this.agentSystem.postAndAwait(contextForUser({ userId: task.userId }), target, {
                        type: "system_message",
                        text: batch.text,
                        code: batch.code,
                        inputs: batch.inputs,
                        inputSchemas: batch.inputSchemas,
                        origin: "heartbeat",
                        execute: true
                    });
                }
            },
            onError: async (error, taskIds) => {
                logger.warn({ taskIds, error }, "error: Heartbeat task failed");
            },
            onTaskComplete: (task, runAt) => {
                this.eventBus.emit("heartbeat.task.ran", { taskId: task.id, runAt: runAt.toISOString() });
            }
        });
    }

    async start(): Promise<void> {
        await this.scheduler.start();
        const tasks = await this.listTasks();
        this.eventBus.emit("heartbeat.started", { tasks });
        if (tasks.length === 0) {
            logger.info("event: No heartbeat tasks found on boot.");
            return;
        }
        const withLastRun = tasks.filter((task) => typeof task.lastRunAt === "number");
        const missingLastRun = tasks.filter((task) => typeof task.lastRunAt !== "number");
        if (withLastRun.length > 0) {
            const mostRecent = Math.max(...withLastRun.map((task) => task.lastRunAt ?? 0));
            logger.info(
                {
                    taskCount: tasks.length,
                    mostRecentRunAt: new Date(mostRecent).toISOString()
                },
                "load: Heartbeat last run loaded on boot"
            );
        }
        if (missingLastRun.length > 0) {
            logger.info(
                {
                    taskCount: missingLastRun.length,
                    taskIds: missingLastRun.map((task) => task.id)
                },
                "event: Heartbeat missing last run info; running now"
            );
            await this.runNow({ ids: missingLastRun.map((task) => task.id) });
        }
        const nextRunAt = this.scheduler.getNextRunAt() ?? new Date(Date.now() + this.scheduler.getIntervalMs());
        logger.info({ nextRunAt: nextRunAt.toISOString() }, "schedule: Next heartbeat run scheduled");
    }

    stop(): void {
        this.scheduler.stop();
    }

    async listTasks(): Promise<HeartbeatDefinition[]> {
        return this.scheduler.listTasks();
    }

    async runNow(args?: { ids?: string[] }): Promise<{ ran: number; taskIds: string[] }> {
        return this.scheduler.runNow(args?.ids);
    }

    async addTask(ctx: Context, args: HeartbeatCreateTaskArgs): Promise<HeartbeatDefinition> {
        const userId = ctx.userId.trim();
        if (!userId) {
            throw new Error("Heartbeat userId is required.");
        }

        const existingTrigger = args.id ? await this.storage.heartbeatTasks.findById(args.id) : null;
        if (existingTrigger && existingTrigger.userId !== userId) {
            throw new Error(`Heartbeat belongs to another user: ${existingTrigger.id}`);
        }

        const taskId = args.taskId;
        const taskRecord = await this.storage.tasks.findById(ctx, taskId);
        if (!taskRecord) {
            throw new Error(`Task not found: ${taskId}`);
        }

        return this.scheduler.createTask(ctx, args);
    }

    async removeTask(ctx: Context, taskId: string): Promise<boolean> {
        const existing = await this.storage.heartbeatTasks.findById(taskId);
        if (!existing || existing.userId !== ctx.userId.trim()) {
            return false;
        }

        const deleted = await this.scheduler.deleteTask(ctx, taskId);
        if (deleted && existing.taskId) {
            await this.taskDeleteIfOrphan(ctx, existing.taskId);
        }
        return deleted;
    }

    async addTrigger(ctx: Context, input: { taskId: string; id?: string; parameters?: Record<string, unknown> }) {
        const task = await this.storage.tasks.findById(ctx, input.taskId);
        if (!task) {
            throw new Error(`Task not found: ${input.taskId}`);
        }
        return this.addTask(ctx, {
            id: input.id,
            taskId: input.taskId,
            parameters: input.parameters
        });
    }

    async listTriggersForTask(ctx: Context, taskId: string) {
        return this.storage.heartbeatTasks.findManyByTaskId(ctx, taskId);
    }

    async deleteTriggersForTask(ctx: Context, taskId: string): Promise<number> {
        const triggers = await this.storage.heartbeatTasks.findManyByTaskId(ctx, taskId);
        let removed = 0;
        for (const trigger of triggers) {
            if (await this.removeTask(ctx, trigger.id)) {
                removed += 1;
            }
        }
        return removed;
    }

    private async taskDeleteIfOrphan(ctx: Context, taskId: string): Promise<void> {
        const [cronTriggers, heartbeatTriggers, webhookTriggers] = await Promise.all([
            this.storage.cronTasks.findManyByTaskId(ctx, taskId),
            this.storage.heartbeatTasks.findManyByTaskId(ctx, taskId),
            this.storage.webhookTasks.findManyByTaskId(ctx, taskId)
        ]);
        if (cronTriggers.length > 0 || heartbeatTriggers.length > 0 || webhookTriggers.length > 0) {
            return;
        }
        await this.storage.tasks.delete(ctx, taskId);
    }
}
