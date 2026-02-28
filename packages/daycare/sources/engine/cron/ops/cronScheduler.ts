import { createId } from "@paralleldrive/cuid2";
import type { Context, MessageContext } from "@/types";
import { getLogger } from "../../../log.js";
import type { CronTasksRepository } from "../../../storage/cronTasksRepository.js";
import type { CronTaskDbRecord } from "../../../storage/databaseTypes.js";
import type { TasksRepository } from "../../../storage/tasksRepository.js";
import type { UsersRepository } from "../../../storage/usersRepository.js";
import { taskIdIsSafe } from "../../../utils/taskIdIsSafe.js";
import type { ConfigModule } from "../../config/configModule.js";
import { taskParameterInputsNormalize } from "../../modules/tasks/taskParameterInputsNormalize.js";
import type { TaskParameter } from "../../modules/tasks/taskParameterTypes.js";
import { taskParameterValidate } from "../../modules/tasks/taskParameterValidate.js";
import type { CronTaskContext, CronTaskDefinition, CronTaskInfo, ScheduledTask } from "../cronTypes.js";
import { cronTimeGetNext } from "./cronTimeGetNext.js";
import { cronTimezoneResolve } from "./cronTimezoneResolve.js";

const logger = getLogger("cron.scheduler");

export type CronSchedulerOptions = {
    config: ConfigModule;
    repository: CronTasksRepository;
    tasksRepository: TasksRepository;
    usersRepository: UsersRepository;
    onTask: (context: CronTaskContext, messageContext: MessageContext) => void | Promise<void>;
    onError?: (error: unknown, taskId: string) => void | Promise<void>;
    onTaskComplete?: (task: CronTaskDbRecord, runAt: Date) => void | Promise<void>;
};

/**
 * Schedules and executes cron tasks based on their cron expressions.
 */
export class CronScheduler {
    private config: ConfigModule;
    private repository: CronTasksRepository;
    private tasksRepository: TasksRepository;
    private usersRepository: UsersRepository;
    private tasks = new Map<string, ScheduledTask>();
    private started = false;
    private stopped = false;
    private onTask: CronSchedulerOptions["onTask"];
    private onError?: CronSchedulerOptions["onError"];
    private onTaskComplete?: CronSchedulerOptions["onTaskComplete"];
    private tickTimer: NodeJS.Timeout | null = null;
    private runningTasks = new Set<string>();

    constructor(options: CronSchedulerOptions) {
        this.config = options.config;
        this.repository = options.repository;
        this.tasksRepository = options.tasksRepository;
        this.usersRepository = options.usersRepository;
        this.onTask = options.onTask;
        this.onError = options.onError;
        this.onTaskComplete = options.onTaskComplete;
        logger.debug("init: CronScheduler initialized");
    }

    async start(): Promise<void> {
        logger.debug(`start: start() called started=${this.started} stopped=${this.stopped}`);
        if (this.started || this.stopped) {
            logger.debug("start: Already started or stopped, returning");
            return;
        }

        this.started = true;

        const tasks = await this.repository.findAll();
        logger.debug(`load: Loaded tasks from db taskCount=${tasks.length}`);

        for (const task of tasks) {
            this.scheduleTask(task);
        }

        this.scheduleNextTick();
        logger.debug("schedule: All tasks scheduled");
    }

    stop(): void {
        logger.debug(`stop: stop() called stopped=${this.stopped}`);
        if (this.stopped) {
            logger.debug("stop: Already stopped, returning");
            return;
        }

        this.stopped = true;
        logger.debug(`event: Clearing timers taskCount=${this.tasks.size}`);

        if (this.tickTimer) {
            clearTimeout(this.tickTimer);
            this.tickTimer = null;
        }
        this.runningTasks.clear();
        this.tasks.clear();
        logger.debug("stop: CronScheduler stopped");
    }

    async reload(): Promise<void> {
        logger.debug("reload: Reloading tasks from db");

        this.tasks.clear();

        if (!this.started || this.stopped) {
            return;
        }

        const tasks = await this.repository.findAll();
        for (const task of tasks) {
            this.scheduleTask(task);
        }

        this.scheduleNextTick();
        logger.debug(`reload: Tasks reloaded taskCount=${this.tasks.size}`);
    }

    listTasks(): CronTaskDbRecord[] {
        return Array.from(this.tasks.values()).map((scheduled) => cronTaskClone(scheduled.task));
    }

    async addTask(
        ctx: Context,
        definition: Omit<CronTaskDefinition, "id" | "userId"> & { id?: string }
    ): Promise<CronTaskDbRecord> {
        const userId = ctx.userId.trim();
        if (!userId) {
            throw new Error("Cron userId is required.");
        }
        const providedId = definition.id?.trim();
        if (providedId && !taskIdIsSafe(providedId)) {
            throw new Error("Cron trigger id contains invalid characters.");
        }

        const triggerId = providedId ?? createId();
        const existing = await this.repository.findById(triggerId);
        if (existing && existing.userId !== userId) {
            throw new Error(`Cron task belongs to another user: ${triggerId}`);
        }
        const linkedTask = await this.tasksRepository.findById(ctx, definition.taskId);
        if (!linkedTask) {
            throw new Error(`Task not found: ${definition.taskId}`);
        }
        const now = Date.now();
        const task: CronTaskDbRecord = {
            id: triggerId,
            taskId: definition.taskId,
            userId,
            name: linkedTask.title,
            description: linkedTask.description,
            schedule: definition.schedule,
            timezone: await this.timezoneResolve(userId, definition.timezone),
            agentId: definition.agentId ?? null,
            enabled: definition.enabled !== false,
            deleteAfterRun: definition.deleteAfterRun === true,
            parameters: definition.parameters ?? null,
            lastRunAt: null,
            createdAt: now,
            updatedAt: now
        };

        await this.repository.create(task);

        if (task.enabled && this.started && !this.stopped) {
            this.scheduleTask(task);
            this.scheduleNextTick();
        }

        return cronTaskClone(task);
    }

    async deleteTask(ctx: Context, taskId: string): Promise<boolean> {
        const userId = ctx.userId.trim();
        if (!userId) {
            return false;
        }
        const existing = await this.repository.findById(taskId);
        if (!existing || existing.userId !== userId) {
            return false;
        }
        this.tasks.delete(taskId);
        this.runningTasks.delete(taskId);
        const deleted = await this.repository.delete(taskId);
        if (this.started && !this.stopped) {
            this.scheduleNextTick();
        }
        return deleted;
    }

    async loadTask(taskId: string): Promise<CronTaskDbRecord | null> {
        return this.repository.findById(taskId);
    }

    getTaskContext(taskId: string): CronTaskInfo | null {
        const scheduled = this.tasks.get(taskId);
        if (!scheduled) {
            return null;
        }

        return {
            triggerId: scheduled.task.id,
            taskId: scheduled.task.taskId,
            taskName: scheduled.task.name,
            timezone: scheduled.task.timezone,
            agentId: scheduled.task.agentId,
            userId: scheduled.task.userId
        };
    }

    private scheduleTask(task: CronTaskDbRecord): void {
        const nextRun = cronTimeGetNext(task.schedule, undefined, task.timezone);
        if (!nextRun) {
            logger.warn(
                { taskId: task.id, schedule: task.schedule, timezone: task.timezone },
                "schedule: Invalid cron schedule"
            );
            void this.reportError(
                new Error(`Invalid cron schedule: ${task.schedule} (timezone: ${task.timezone})`),
                task.id
            );
            return;
        }
        logger.debug(
            {
                taskId: task.id,
                schedule: task.schedule,
                timezone: task.timezone,
                nextRun: nextRun.toISOString()
            },
            "schedule: Scheduling task"
        );
        this.tasks.set(task.id, { task: cronTaskClone(task), nextRun, timer: null });
    }

    private async executeTask(task: CronTaskDbRecord): Promise<void> {
        await this.config.inReadLock(async () => this.executeTaskUnlocked(task));
    }

    private async executeTaskUnlocked(task: CronTaskDbRecord): Promise<void> {
        logger.debug(`event: executeTask() called taskId=${task.id}`);

        if (this.stopped) {
            logger.debug("stop: Scheduler stopped, not executing");
            return;
        }

        const runAt = new Date();
        const runAtMs = runAt.getTime();

        try {
            const runtimeTask = await this.taskRuntimeResolve(task);

            // Validate trigger parameters
            let inputValues: Record<string, unknown> | undefined;
            let inputSchema: TaskParameter[] | undefined;
            if (runtimeTask.parameterSchema?.length) {
                const values = task.parameters ?? {};
                const error = taskParameterValidate(runtimeTask.parameterSchema, values);
                if (error) {
                    logger.warn({ taskId: task.id, error }, "error: Cron trigger parameter validation failed");
                    throw new Error(`Parameter validation failed for cron trigger ${task.id}: ${error}`);
                }
                inputValues = taskParameterInputsNormalize(runtimeTask.parameterSchema, values);
                inputSchema = runtimeTask.parameterSchema;
            }

            const taskContext: CronTaskContext = {
                triggerId: task.id,
                taskId: runtimeTask.taskId,
                taskName: runtimeTask.taskTitle,
                code: runtimeTask.code,
                timezone: task.timezone,
                agentId: task.agentId,
                userId: task.userId,
                parameters: task.parameters ?? undefined,
                inputs: inputValues,
                inputSchema
            };

            const messageContext: MessageContext = { timezone: task.timezone };

            logger.info({ taskId: task.id, name: task.name }, "execute: Executing cron task");
            await this.onTask(taskContext, messageContext);
            logger.debug(`event: Task execution completed taskId=${task.id}`);
        } catch (error) {
            logger.warn({ taskId: task.id, error }, "error: Cron task execution failed");
            await this.reportError(error, task.id);
        } finally {
            task.lastRunAt = runAtMs;
            task.updatedAt = runAtMs;
            await this.repository.update(task.id, {
                lastRunAt: runAtMs,
                updatedAt: runAtMs
            });
            await this.onTaskComplete?.(cronTaskClone(task), runAt);
        }
    }

    private async reportError(error: unknown, taskId: string): Promise<void> {
        if (!this.onError) {
            return;
        }
        await this.onError(error, taskId);
    }

    private async taskRuntimeResolve(
        task: CronTaskDbRecord
    ): Promise<{ taskId: string; taskTitle: string; code: string; parameterSchema: TaskParameter[] | null }> {
        const linkedTask = await this.tasksRepository.findById(
            { userId: task.userId, agentId: task.agentId ?? "system:cron" },
            task.taskId
        );
        if (!linkedTask) {
            throw new Error(`Cron trigger ${task.id} references missing task: ${task.taskId}`);
        }
        return {
            taskId: linkedTask.id,
            taskTitle: linkedTask.title,
            code: linkedTask.code,
            parameterSchema: linkedTask.parameters
        };
    }

    private runTick(): void {
        try {
            this.runTickUnlocked();
        } catch (error) {
            logger.warn({ error }, "error: Cron tick failed");
        }
    }

    private runTickUnlocked(): void {
        if (this.stopped) {
            return;
        }

        const now = new Date();
        let nextDue: Date | null = null;
        for (const scheduled of this.tasks.values()) {
            if (now.getTime() >= scheduled.nextRun.getTime()) {
                const nextRun = cronTimeGetNext(scheduled.task.schedule, now, scheduled.task.timezone);
                if (!nextRun) {
                    logger.warn(
                        {
                            taskId: scheduled.task.id,
                            schedule: scheduled.task.schedule,
                            timezone: scheduled.task.timezone
                        },
                        "schedule: Invalid cron schedule"
                    );
                    void this.reportError(
                        new Error(
                            `Invalid cron schedule: ${scheduled.task.schedule} (timezone: ${scheduled.task.timezone})`
                        ),
                        scheduled.task.id
                    );
                } else {
                    scheduled.nextRun = nextRun;
                    this.tasks.set(scheduled.task.id, scheduled);
                }

                if (this.runningTasks.has(scheduled.task.id)) {
                    continue;
                }

                if (scheduled.task.deleteAfterRun) {
                    this.tasks.delete(scheduled.task.id);
                }

                this.runningTasks.add(scheduled.task.id);
                void this.executeTask(scheduled.task)
                    .catch(() => {})
                    .finally(() => {
                        this.runningTasks.delete(scheduled.task.id);
                        if (scheduled.task.deleteAfterRun) {
                            this.tasks.delete(scheduled.task.id);
                            void this.repository.delete(scheduled.task.id).catch((error) => {
                                logger.warn({ taskId: scheduled.task.id, error }, "error: Failed to delete cron task");
                            });
                        }
                    });
            }

            if (!nextDue || scheduled.nextRun.getTime() < nextDue.getTime()) {
                nextDue = scheduled.nextRun;
            }
        }

        this.scheduleNextTick(nextDue);
    }

    private scheduleNextTick(nextDue?: Date | null): void {
        if (this.stopped) {
            return;
        }
        if (this.tickTimer) {
            clearTimeout(this.tickTimer);
        }

        const now = new Date();
        const delay = nextDue ? nextDue.getTime() - now.getTime() : 60 * 1000;
        const waitMs = Math.max(0, Math.min(delay, 60 * 1000));
        this.tickTimer = setTimeout(() => {
            this.tickTimer = null;
            this.runTick();
        }, waitMs);
    }

    private async timezoneResolve(userId: string, timezone?: string): Promise<string> {
        const user = await this.usersRepository.findById(userId);
        return cronTimezoneResolve({ timezone, profileTimezone: user?.timezone });
    }
}

function cronTaskClone(task: CronTaskDbRecord): CronTaskDbRecord {
    return { ...task, parameters: task.parameters ? structuredClone(task.parameters) : task.parameters };
}
