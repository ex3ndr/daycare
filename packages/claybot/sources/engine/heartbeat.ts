import { getLogger } from "../log.js";
import type { HeartbeatDefinition } from "./heartbeat-store.js";
import { HeartbeatStore } from "./heartbeat-store.js";

const logger = getLogger("heartbeat.scheduler");

export type HeartbeatSchedulerOptions = {
  store: HeartbeatStore;
  intervalMs?: number;
  onRun: (tasks: HeartbeatDefinition[], runAt: Date) => void | Promise<void>;
  onError?: (error: unknown, taskIds?: string[]) => void | Promise<void>;
  onTaskComplete?: (task: HeartbeatDefinition, runAt: Date) => void | Promise<void>;
};

export class HeartbeatScheduler {
  private store: HeartbeatStore;
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
    this.store = options.store;
    this.intervalMs = options.intervalMs ?? 30 * 60 * 1000;
    this.onRun = options.onRun;
    this.onError = options.onError;
    this.onTaskComplete = options.onTaskComplete;
    logger.debug("HeartbeatScheduler initialized");
  }

  async start(): Promise<void> {
    logger.debug(`start() called started=${this.started} stopped=${this.stopped}`);
    if (this.started || this.stopped) {
      return;
    }
    this.started = true;
    this.scheduleNext();
  }

  stop(): void {
    logger.debug(`stop() called stopped=${this.stopped}`);
    if (this.stopped) {
      return;
    }
    this.stopped = true;
    if (this.timer) {
      clearTimeout(this.timer);
      this.timer = null;
    }
    logger.debug("HeartbeatScheduler stopped");
  }

  async runNow(taskIds?: string[]): Promise<{ ran: number; taskIds: string[] }> {
    return this.runOnce(taskIds);
  }

  async listTasks(): Promise<HeartbeatDefinition[]> {
    return this.store.listTasks();
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
    if (this.running) {
      logger.debug("HeartbeatScheduler run skipped (already running)");
      return { ran: 0, taskIds: [] };
    }
    this.running = true;
    try {
      const tasks = await this.store.listTasks();
      const filtered = taskIds && taskIds.length > 0
        ? tasks.filter((task) => taskIds.includes(task.id))
        : tasks;
      if (filtered.length === 0) {
        return { ran: 0, taskIds: [] };
      }
      const runAt = new Date();
      const ids = filtered.map((task) => task.id);
      logger.info(
        {
          taskCount: filtered.length,
          taskIds: ids
        },
        "Heartbeat run started"
      );
      try {
        await this.onRun(filtered, runAt);
      } catch (error) {
        logger.warn({ taskIds: ids, error }, "Heartbeat run failed");
        await this.onError?.(error, ids);
      } finally {
        await this.store.recordRun(runAt);
        for (const task of filtered) {
          task.lastRunAt = runAt.toISOString();
          await this.onTaskComplete?.(task, runAt);
        }
      }
      logger.info(
        {
          taskCount: filtered.length,
          taskIds: ids
        },
        "Heartbeat run completed"
      );
      return { ran: filtered.length, taskIds: ids };
    } catch (error) {
      logger.warn({ error }, "Heartbeat run failed");
      await this.onError?.(error, undefined);
      return { ran: 0, taskIds: [] };
    } finally {
      this.running = false;
    }
  }
}
