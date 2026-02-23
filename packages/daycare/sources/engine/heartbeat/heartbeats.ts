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

    constructor(options: HeartbeatsOptions) {
        this.eventBus = options.eventBus;
        this.agentSystem = options.agentSystem;
        this.scheduler = new HeartbeatScheduler({
            config: options.config,
            repository: options.storage.heartbeatTasks,
            intervalMs: options.intervalMs,
            onRun: async (tasks) => {
                const tasksByUser = new Map<string, typeof tasks>();
                for (const task of tasks) {
                    const list = tasksByUser.get(task.userId) ?? [];
                    list.push(task);
                    tasksByUser.set(task.userId, list);
                }
                for (const [userId, userTasks] of tasksByUser.entries()) {
                    const target = { descriptor: { type: "system" as const, tag: "heartbeat" } };
                    const batch = heartbeatPromptBuildBatch(userTasks);
                    await this.agentSystem.postAndAwait(contextForUser({ userId }), target, {
                        type: "system_message",
                        text: batch.prompt,
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
        return this.scheduler.createTask(ctx, args);
    }

    async removeTask(ctx: Context, taskId: string): Promise<boolean> {
        return this.scheduler.deleteTask(ctx, taskId);
    }
}
