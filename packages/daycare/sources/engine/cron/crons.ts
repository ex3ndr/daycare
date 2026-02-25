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
 * Posts cron task prompts directly to the agent system.
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
            onTask: async (task, messageContext) => {
                const target = task.agentId
                    ? { agentId: task.agentId }
                    : { descriptor: { type: "system" as const, tag: "cron" } };
                logger.debug(
                    `event: CronScheduler.onTask triggered taskUid=${task.taskUid} agentId=${task.agentId ?? "system:cron"}`
                );

                await this.agentSystem.postAndAwait(contextForUser({ userId: task.userId }), target, {
                    type: "system_message",
                    text: cronTaskPromptBuild(task),
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
        const task = await this.scheduler.addTask(ctx, definition);
        this.eventBus.emit("cron.task.added", { task });
        return task;
    }

    async deleteTask(ctx: Context, taskId: string): Promise<boolean> {
        return this.scheduler.deleteTask(ctx, taskId);
    }

    async loadTask(taskId: string) {
        return this.scheduler.loadTask(taskId);
    }
}

function cronTaskPromptBuild(task: { prompt: string; taskId: string; taskUid: string; taskName: string }): string {
    return [
        "[cron]",
        `taskId: ${task.taskId}`,
        `taskUid: ${task.taskUid}`,
        `taskName: ${task.taskName}`,
        "",
        "<run_python>",
        task.prompt,
        "</run_python>"
    ].join("\n");
}
