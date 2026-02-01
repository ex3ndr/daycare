import { getLogger } from "../../log.js";
import type { EngineEventBus } from "../ipc/events.js";
import { heartbeatPromptBuildBatch } from "./heartbeatPromptBuildBatch.js";
import { HeartbeatScheduler } from "./heartbeatScheduler.js";
import { HeartbeatStore } from "./heartbeatStore.js";
import type { HeartbeatCreateTaskArgs, HeartbeatDefinition } from "./heartbeatTypes.js";

const logger = getLogger("heartbeat.facade");

export type HeartbeatRuntime = {
  resolveSessionId: () => string;
  startBackgroundAgent: (args: {
    prompt: string;
    sessionId: string;
    context: { userId: string; heartbeat: Record<string, never> };
  }) => Promise<{ sessionId: string }>;
};

export type HeartbeatsOptions = {
  basePath: string;
  eventBus: EngineEventBus;
  runtime: HeartbeatRuntime;
  intervalMs?: number;
};

/**
 * Coordinates heartbeat storage + scheduling for engine runtime.
 * Expects: runtime resolves session ids and starts background agents.
 */
export class Heartbeats {
  private eventBus: EngineEventBus;
  private runtime: HeartbeatRuntime;
  private scheduler: HeartbeatScheduler;
  private store: HeartbeatStore;

  constructor(options: HeartbeatsOptions) {
    this.eventBus = options.eventBus;
    this.runtime = options.runtime;
    this.store = new HeartbeatStore(options.basePath);
    this.scheduler = new HeartbeatScheduler({
      store: this.store,
      intervalMs: options.intervalMs,
      onRun: async (tasks) => {
        const sessionId = this.runtime.resolveSessionId();
        const batch = heartbeatPromptBuildBatch(tasks);
        await this.runtime.startBackgroundAgent({
          prompt: batch.prompt,
          sessionId,
          context: { userId: "heartbeat", heartbeat: {} }
        });
      },
      onError: (error, taskIds) => {
        logger.warn({ taskIds, error }, "Heartbeat task failed");
      },
      onTaskComplete: (task, runAt) => {
        this.eventBus.emit("heartbeat.task.ran", { taskId: task.id, runAt: runAt.toISOString() });
      }
    });
  }

  async ensureDir(): Promise<void> {
    await this.store.ensureDir();
  }

  async start(): Promise<void> {
    await this.scheduler.start();
    const tasks = await this.listTasks();
    this.eventBus.emit("heartbeat.started", { tasks });
    if (tasks.length === 0) {
      logger.info("No heartbeat tasks found on boot.");
      return;
    }
    const withLastRun = tasks.filter((task) => !!task.lastRunAt);
    const missingLastRun = tasks.filter((task) => !task.lastRunAt);
    if (withLastRun.length > 0) {
      const mostRecent = withLastRun
        .map((task) => task.lastRunAt as string)
        .sort()
        .at(-1);
      logger.info(
        {
          taskCount: tasks.length,
          mostRecentRunAt: mostRecent
        },
        "Heartbeat last run loaded on boot"
      );
    }
    if (missingLastRun.length > 0) {
      logger.info(
        {
          taskCount: missingLastRun.length,
          taskIds: missingLastRun.map((task) => task.id)
        },
        "Heartbeat missing last run info; running now"
      );
      await this.runNow({ ids: missingLastRun.map((task) => task.id) });
    }
    const nextRunAt =
      this.scheduler.getNextRunAt() ??
      new Date(Date.now() + this.scheduler.getIntervalMs());
    logger.info({ nextRunAt: nextRunAt.toISOString() }, "Next heartbeat run scheduled");
  }

  stop(): void {
    this.scheduler.stop();
  }

  async listTasks(): Promise<HeartbeatDefinition[]> {
    return this.store.listTasks();
  }

  async runNow(args?: { ids?: string[] }): Promise<{ ran: number; taskIds: string[] }> {
    return this.scheduler.runNow(args?.ids);
  }

  async addTask(args: HeartbeatCreateTaskArgs): Promise<HeartbeatDefinition> {
    return this.store.createTask(args);
  }

  async removeTask(taskId: string): Promise<boolean> {
    return this.store.deleteTask(taskId);
  }
}
