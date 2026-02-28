import { createId } from "@paralleldrive/cuid2";
import type { Context } from "@/types";
import { getLogger } from "../../../log.js";
import type { HeartbeatTaskDbRecord } from "../../../storage/databaseTypes.js";
import { taskIdIsSafe } from "../../../utils/taskIdIsSafe.js";
import { taskParameterValidate } from "../../modules/tasks/taskParameterValidate.js";
import type {
    HeartbeatCreateTaskArgs,
    HeartbeatDefinition,
    HeartbeatRunTask,
    HeartbeatSchedulerOptions
} from "../heartbeatTypes.js";

const logger = getLogger("heartbeat.scheduler");

/**
 * Manages interval-based heartbeat task execution.
 *
 * Runs all heartbeat tasks in a single batch at regular intervals.
 */
export class HeartbeatScheduler {
    private config: HeartbeatSchedulerOptions["config"];
    private repository: HeartbeatSchedulerOptions["repository"];
    private tasksRepository: HeartbeatSchedulerOptions["tasksRepository"];
    private intervalMs: number;
    private onRun: HeartbeatSchedulerOptions["onRun"];
    private onError?: HeartbeatSchedulerOptions["onError"];
    private onTaskComplete?: HeartbeatSchedulerOptions["onTaskComplete"];
    private timer: NodeJS.Timeout | null = null;
    private started = false;
    private stopped = false;
    private running = false;
    private nextRunAt: Date | null = null;

    constructor(options: HeartbeatSchedulerOptions) {
        this.config = options.config;
        this.repository = options.repository;
        this.tasksRepository = options.tasksRepository;
        this.intervalMs = options.intervalMs ?? 30 * 60 * 1000;
        this.onRun = options.onRun;
        this.onError = options.onError;
        this.onTaskComplete = options.onTaskComplete;
        logger.debug("init: HeartbeatScheduler initialized");
    }

    async start(): Promise<void> {
        logger.debug(`start: start() called started=${this.started} stopped=${this.stopped}`);
        if (this.started || this.stopped) {
            return;
        }
        this.started = true;
        this.scheduleNext();
    }

    stop(): void {
        logger.debug(`stop: stop() called stopped=${this.stopped}`);
        if (this.stopped) {
            return;
        }
        this.stopped = true;
        if (this.timer) {
            clearTimeout(this.timer);
            this.timer = null;
        }
        logger.debug("stop: HeartbeatScheduler stopped");
    }

    async runNow(taskIds?: string[]): Promise<{ ran: number; taskIds: string[] }> {
        return this.runOnce(taskIds);
    }

    async listTasks(): Promise<HeartbeatDefinition[]> {
        return this.repository.findAll();
    }

    async createTask(ctx: Context, definition: HeartbeatCreateTaskArgs): Promise<HeartbeatDefinition> {
        const providedId = definition.id?.trim();
        if (providedId && !taskIdIsSafe(providedId)) {
            throw new Error("Heartbeat id contains invalid characters.");
        }

        const triggerId = providedId ?? createId();
        const existing = await this.repository.findById(triggerId);
        const userId = ctx.userId.trim();
        if (!userId) {
            throw new Error("Heartbeat userId is required.");
        }
        if (existing && existing.userId !== userId) {
            throw new Error(`Heartbeat belongs to another user: ${triggerId}`);
        }
        if (existing && !definition.overwrite) {
            throw new Error(`Heartbeat already exists: ${triggerId}`);
        }

        const linkedTask = await this.tasksRepository.findById(ctx, definition.taskId);
        if (!linkedTask) {
            throw new Error(`Task not found: ${definition.taskId}`);
        }
        const title = linkedTask.title;

        const now = Date.now();
        if (existing) {
            const updated: HeartbeatDefinition = {
                ...existing,
                taskId: definition.taskId,
                userId,
                title,
                parameters: definition.parameters ?? existing.parameters,
                updatedAt: now
            };
            await this.repository.update(triggerId, updated);
            return heartbeatTaskClone(updated);
        }

        const created: HeartbeatDefinition = {
            id: triggerId,
            taskId: definition.taskId,
            userId,
            title,
            parameters: definition.parameters ?? null,
            lastRunAt: null,
            createdAt: now,
            updatedAt: now
        };
        await this.repository.create(created);
        return heartbeatTaskClone(created);
    }

    async deleteTask(ctx: Context, taskId: string): Promise<boolean> {
        if (!taskIdIsSafe(taskId)) {
            throw new Error("Heartbeat id contains invalid characters.");
        }
        const userId = ctx.userId.trim();
        if (!userId) {
            return false;
        }
        const existing = await this.repository.findById(taskId);
        if (!existing || existing.userId !== userId) {
            return false;
        }
        return this.repository.delete(taskId);
    }

    getIntervalMs(): number {
        return this.intervalMs;
    }

    getNextRunAt(): Date | null {
        return this.nextRunAt;
    }
    private scheduleNext(): void {
        if (this.stopped) {
            return;
        }
        if (this.timer) {
            clearTimeout(this.timer);
        }
        this.nextRunAt = new Date(Date.now() + this.intervalMs);
        this.timer = setTimeout(() => {
            this.timer = null;
            void this.tick();
        }, this.intervalMs);
    }

    private async tick(): Promise<void> {
        if (this.stopped) {
            return;
        }
        try {
            await this.runOnce();
        } finally {
            this.scheduleNext();
        }
    }

    private async runOnce(taskIds?: string[]): Promise<{ ran: number; taskIds: string[] }> {
        return this.config.inReadLock(async () => this.runOnceUnlocked(taskIds));
    }

    private async runOnceUnlocked(taskIds?: string[]): Promise<{ ran: number; taskIds: string[] }> {
        if (this.running) {
            logger.debug("skip: HeartbeatScheduler run skipped (already running)");
            return { ran: 0, taskIds: [] };
        }
        this.running = true;
        try {
            const tasks = await this.repository.findAll();
            const filtered = taskIds && taskIds.length > 0 ? tasks.filter((task) => taskIds.includes(task.id)) : tasks;
            if (filtered.length === 0) {
                return { ran: 0, taskIds: [] };
            }
            const runTasks = await this.runTasksResolve(filtered);
            const runAt = new Date();
            const runAtMs = runAt.getTime();
            const ids = runTasks.map((task) => task.id);
            logger.info(
                {
                    taskCount: runTasks.length,
                    taskIds: ids
                },
                "start: Heartbeat run started"
            );
            try {
                await this.onRun(runTasks, runAt);
            } catch (error) {
                logger.warn({ taskIds: ids, error }, "error: Heartbeat run failed");
                await this.onError?.(error, ids);
            } finally {
                await this.repository.recordRun(runAtMs);
                for (const task of filtered) {
                    task.lastRunAt = runAtMs;
                    task.updatedAt = runAtMs;
                    const completedTask = runTasks.find((candidate) => candidate.id === task.id) ?? task;
                    await this.onTaskComplete?.(heartbeatTaskClone(completedTask), runAt);
                }
            }
            logger.info(
                {
                    taskCount: runTasks.length,
                    taskIds: ids
                },
                "event: Heartbeat run completed"
            );
            return { ran: runTasks.length, taskIds: ids };
        } catch (error) {
            logger.warn({ error }, "error: Heartbeat run failed");
            await this.onError?.(error, undefined);
            return { ran: 0, taskIds: [] };
        } finally {
            this.running = false;
        }
    }

    private async runTasksResolve(tasks: HeartbeatTaskDbRecord[]): Promise<HeartbeatRunTask[]> {
        const resolved: HeartbeatRunTask[] = [];
        for (const trigger of tasks) {
            const linked = await this.tasksRepository.findById(
                { userId: trigger.userId, agentId: "system:heartbeat" },
                trigger.taskId
            );
            if (!linked) {
                throw new Error(`Heartbeat trigger ${trigger.id} references missing task: ${trigger.taskId}`);
            }

            // Validate trigger parameters and pass as native inputs
            let inputValues: Record<string, unknown> | undefined;
            if (linked.parameters?.length && trigger.parameters) {
                const error = taskParameterValidate(linked.parameters, trigger.parameters);
                if (error) {
                    logger.warn(
                        { triggerId: trigger.id, error },
                        "error: Heartbeat trigger parameter validation failed"
                    );
                    throw new Error(`Parameter validation failed for heartbeat trigger ${trigger.id}: ${error}`);
                }
                inputValues = trigger.parameters;
            }

            resolved.push({
                ...trigger,
                taskId: linked.id,
                title: linked.title,
                code: linked.code,
                inputs: inputValues
            });
        }
        return resolved;
    }
}

function heartbeatTaskClone(task: HeartbeatDefinition): HeartbeatDefinition {
    return { ...task };
}
