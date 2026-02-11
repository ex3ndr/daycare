import { getLogger } from "../../../log.js";
import { CronStore } from "./cronStore.js";
import type {
  CronTaskDefinition,
  CronTaskWithPaths,
  CronTaskContext,
  ScheduledTask
} from "../cronTypes.js";
import { cronTimeGetNext } from "./cronTimeGetNext.js";
import type { MessageContext } from "@/types";
import type { SessionPermissions } from "@/types";
import { permissionBuildCron } from "../../permissions/permissionBuildCron.js";
import { permissionClone } from "../../permissions/permissionClone.js";
import {
  execGateCheck,
  type ExecGateCheckInput,
  type ExecGateCheckResult
} from "../../scheduling/execGateCheck.js";
import { execGateOutputAppend } from "../../scheduling/execGateOutputAppend.js";
import { gatePermissionsCheck } from "../../scheduling/gatePermissionsCheck.js";
import type { ConfigModule } from "../../config/configModule.js";

const logger = getLogger("cron.scheduler");

export type CronSchedulerOptions = {
  config: ConfigModule;
  store: CronStore;
  defaultPermissions: SessionPermissions;
  resolvePermissions?: (task: CronTaskWithPaths) => Promise<SessionPermissions> | SessionPermissions;
  onTask: (context: CronTaskContext, messageContext: MessageContext) => void | Promise<void>;
  onError?: (error: unknown, taskId: string) => void | Promise<void>;
  onGatePermissionSkip?: (
    task: CronTaskWithPaths,
    missing: string[]
  ) => void | Promise<void>;
  onTaskComplete?: (task: CronTaskWithPaths, runAt: Date) => void | Promise<void>;
  gateCheck?: (input: ExecGateCheckInput) => Promise<ExecGateCheckResult>;
};

/**
 * Schedules and executes cron tasks based on their cron expressions.
 */
export class CronScheduler {
  private config: ConfigModule;
  private store: CronStore;
  private tasks = new Map<string, ScheduledTask>();
  private started = false;
  private stopped = false;
  private onTask: CronSchedulerOptions["onTask"];
  private onError?: CronSchedulerOptions["onError"];
  private onGatePermissionSkip?: CronSchedulerOptions["onGatePermissionSkip"];
  private onTaskComplete?: CronSchedulerOptions["onTaskComplete"];
  private defaultPermissions: SessionPermissions;
  private resolvePermissions?: CronSchedulerOptions["resolvePermissions"];
  private gateCheck: CronSchedulerOptions["gateCheck"];
  private tickTimer: NodeJS.Timeout | null = null;
  private runningTasks = new Set<string>();

  constructor(options: CronSchedulerOptions) {
    this.config = options.config;
    this.store = options.store;
    this.onTask = options.onTask;
    this.onError = options.onError;
    this.onGatePermissionSkip = options.onGatePermissionSkip;
    this.onTaskComplete = options.onTaskComplete;
    this.defaultPermissions = options.defaultPermissions;
    this.resolvePermissions = options.resolvePermissions;
    this.gateCheck = options.gateCheck ?? execGateCheck;
    logger.debug("init: CronScheduler initialized");
  }

  async start(): Promise<void> {
    logger.debug(`start: start() called started=${this.started} stopped=${this.stopped}`);
    if (this.started || this.stopped) {
      logger.debug("start: Already started or stopped, returning");
      return;
    }

    this.started = true;

    // Load tasks from disk
    const tasks = await this.store.listTasks();
    logger.debug(`load: Loaded tasks from disk taskCount=${tasks.length}`);

    for (const task of tasks) {
      if (task.enabled === false) {
        logger.debug(`skip: Task disabled, skipping taskId=${task.id}`);
        continue;
      }

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
    logger.debug("reload: Reloading tasks from disk");

    this.tasks.clear();

    if (!this.started || this.stopped) {
      return;
    }

    // Reload from disk
    const tasks = await this.store.listTasks();
    for (const task of tasks) {
      if (task.enabled === false) {
        continue;
      }
      this.scheduleTask(task);
    }

    this.scheduleNextTick();
    logger.debug(`reload: Tasks reloaded taskCount=${this.tasks.size}`);
  }

  listTasks(): CronTaskWithPaths[] {
    return Array.from(this.tasks.values()).map((s) => s.task);
  }

  async addTask(
    definition: Omit<CronTaskDefinition, "id"> & { id?: string }
  ): Promise<CronTaskWithPaths> {
    const taskId = definition.id ?? await this.store.generateTaskIdFromName(definition.name);
    const task = await this.store.createTask(taskId, {
      name: definition.name,
      taskUid: definition.taskUid,
      description: definition.description,
      schedule: definition.schedule,
      prompt: definition.prompt,
      agentId: definition.agentId,
      gate: definition.gate,
      enabled: definition.enabled,
      deleteAfterRun: definition.deleteAfterRun
    });

    if (task.enabled !== false && this.started && !this.stopped) {
      this.scheduleTask(task);
      this.scheduleNextTick();
    }

    return task;
  }

  async deleteTask(taskId: string): Promise<boolean> {
    this.tasks.delete(taskId);
    this.runningTasks.delete(taskId);
    const deleted = await this.store.deleteTask(taskId);
    if (this.started && !this.stopped) {
      this.scheduleNextTick();
    }
    return deleted;
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
      prompt: scheduled.task.prompt,
      memoryPath: scheduled.task.memoryPath,
      filesPath: scheduled.task.filesPath,
      agentId: scheduled.task.agentId
    };
  }

  private scheduleTask(task: CronTaskWithPaths): void {
    const nextRun = cronTimeGetNext(task.schedule);
    if (!nextRun) {
      logger.warn({ taskId: task.id, schedule: task.schedule }, "schedule: Invalid cron schedule");
      void this.reportError(
        new Error(`Invalid cron schedule: ${task.schedule}`),
        task.id
      );
      return;
    }
    logger.debug({
      taskId: task.id,
      schedule: task.schedule,
      nextRun: nextRun.toISOString()
    }, "schedule: Scheduling task");
    this.tasks.set(task.id, { task, nextRun, timer: null });
  }

  private async executeTask(task: CronTaskWithPaths): Promise<void> {
    await this.config.inReadLock(async () => this.executeTaskUnlocked(task));
  }

  private async executeTaskUnlocked(task: CronTaskWithPaths): Promise<void> {
    logger.debug(`event: executeTask() called taskId=${task.id}`);

    if (this.stopped) {
      logger.debug("stop: Scheduler stopped, not executing");
      return;
    }

    const gate = await this.checkGate(task);
    if (!gate.allowed) {
      return;
    }
    const prompt = gate.result
      ? execGateOutputAppend(task.prompt, gate.result)
      : task.prompt;

    const runAt = new Date();

    const taskContext: CronTaskContext = {
      taskId: task.id,
      taskUid: task.taskUid,
      taskName: task.name,
      prompt,
      memoryPath: task.memoryPath,
      filesPath: task.filesPath,
      agentId: task.agentId
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
      task.lastRunAt = runAt.toISOString();
      await this.store.recordRun(task.id, runAt);
      await this.onTaskComplete?.(task, runAt);
    }
  }

  private async reportError(error: unknown, taskId: string): Promise<void> {
    if (!this.onError) {
      return;
    }
    await this.onError(error, taskId);
  }

  private async checkGate(
    task: CronTaskWithPaths
  ): Promise<{ allowed: boolean; result?: ExecGateCheckResult }> {
    if (!task.gate) {
      return { allowed: true };
    }
    const basePermissions = await this.resolvePermissions?.(task)
      ?? permissionBuildCron(this.defaultPermissions, task.filesPath);
    const permissions = permissionClone(basePermissions);
    const permissionCheck = await gatePermissionsCheck(permissions, task.gate.permissions);
    if (!permissionCheck.allowed) {
      logger.warn(
        { taskId: task.id, missing: permissionCheck.missing },
        "event: Cron gate permissions not satisfied; continuing without gate"
      );
      await this.onGatePermissionSkip?.(task, permissionCheck.missing);
      return { allowed: true };
    }
    const result = await this.gateCheck?.({
      gate: task.gate,
      permissions,
      workingDir: permissions.workingDir,
      socketPath: this.config.current.socketPath
    });
    if (!result) {
      return { allowed: true };
    }
    if (result.error) {
      logger.warn({ taskId: task.id, error: result.error }, "error: Cron gate failed");
      await this.reportError(result.error, task.id);
      return { allowed: false };
    }
    if (!result.shouldRun) {
      logger.debug(
        { taskId: task.id, exitCode: result.exitCode },
        "skip: Cron gate skipped execution"
      );
      return { allowed: false, result };
    }
    return { allowed: true, result };
  }

  private runTick(): void {
    try {
      // Tick only computes due work and schedules async task execution; each task
      // independently acquires a read lock in executeTask().
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
              void this.store.deleteTask(scheduled.task.id).catch((error) => {
                logger.warn(
                  { taskId: scheduled.task.id, error },
                  "error: Failed to delete cron task"
                );
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
