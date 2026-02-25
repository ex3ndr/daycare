import { createId } from "@paralleldrive/cuid2";
import type { Context, MessageContext } from "@/types";
import { getLogger } from "../../../log.js";
import type { CronTasksRepository } from "../../../storage/cronTasksRepository.js";
import type { CronTaskDbRecord } from "../../../storage/databaseTypes.js";
import { cuid2Is } from "../../../utils/cuid2Is.js";
import { stringSlugify } from "../../../utils/stringSlugify.js";
import type { ConfigModule } from "../../config/configModule.js";
import type { CronTaskContext, CronTaskDefinition, ScheduledTask } from "../cronTypes.js";
import { cronTimeGetNext } from "./cronTimeGetNext.js";

const logger = getLogger("cron.scheduler");

export type CronSchedulerOptions = {
    config: ConfigModule;
    repository: CronTasksRepository;
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
        const taskId = definition.id ?? (await this.generateTaskIdFromName(definition.name));
        const existing = await this.repository.findById(taskId);
        if (existing && existing.userId !== userId) {
            throw new Error(`Cron task belongs to another user: ${taskId}`);
        }
        const now = Date.now();
        const task: CronTaskDbRecord = {
            id: taskId,
            taskUid: definition.taskUid && cuid2Is(definition.taskUid) ? definition.taskUid : createId(),
            userId,
            name: definition.name,
            description: definition.description ?? null,
            schedule: definition.schedule,
            code: definition.code,
            agentId: definition.agentId ?? null,
            enabled: definition.enabled !== false,
            deleteAfterRun: definition.deleteAfterRun === true,
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

    getTaskContext(taskId: string): CronTaskContext | null {
        const scheduled = this.tasks.get(taskId);
        if (!scheduled) {
            return null;
        }

        return {
            taskId: scheduled.task.id,
            taskUid: scheduled.task.taskUid,
            taskName: scheduled.task.name,
            code: scheduled.task.code,
            agentId: scheduled.task.agentId,
            userId: scheduled.task.userId
        };
    }

    private async generateTaskIdFromName(name: string): Promise<string> {
        const base = stringSlugify(name) || "cron-task";
        const tasks = await this.repository.findAll({ includeDisabled: true });
        const existing = new Set(tasks.map((task) => task.id));

        let candidate = base;
        let suffix = 2;
        while (existing.has(candidate)) {
            candidate = `${base}-${suffix}`;
            suffix += 1;
        }
        return candidate;
    }

    private scheduleTask(task: CronTaskDbRecord): void {
        const nextRun = cronTimeGetNext(task.schedule);
        if (!nextRun) {
            logger.warn({ taskId: task.id, schedule: task.schedule }, "schedule: Invalid cron schedule");
            void this.reportError(new Error(`Invalid cron schedule: ${task.schedule}`), task.id);
            return;
        }
        logger.debug(
            {
                taskId: task.id,
                schedule: task.schedule,
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

        const taskContext: CronTaskContext = {
            taskId: task.id,
            taskUid: task.taskUid,
            taskName: task.name,
            code: task.code,
            agentId: task.agentId,
            userId: task.userId
        };

        const messageContext: MessageContext = {};

        try {
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
                const nextRun = cronTimeGetNext(scheduled.task.schedule, now);
                if (!nextRun) {
                    logger.warn(
                        { taskId: scheduled.task.id, schedule: scheduled.task.schedule },
                        "schedule: Invalid cron schedule"
                    );
                    void this.reportError(
                        new Error(`Invalid cron schedule: ${scheduled.task.schedule}`),
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
}

function cronTaskClone(task: CronTaskDbRecord): CronTaskDbRecord {
    return { ...task };
}
