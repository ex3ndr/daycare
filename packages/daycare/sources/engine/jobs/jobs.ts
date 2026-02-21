import path from "node:path";

import { getLogger } from "../../log.js";
import type { EngineEventBus } from "../ipc/events.js";
import type { ConfigModule } from "../config/configModule.js";
import { JobStore } from "./ops/jobStore.js";
import { JobScheduler } from "./ops/jobScheduler.js";
import type {
  JobDefinition,
  JobEnqueueInput,
  JobHandler,
  JobListOptions,
  JobStatus
} from "./jobTypes.js";

const logger = getLogger("job.facade");

export type JobsOptions = {
  config: ConfigModule;
  eventBus: EngineEventBus;
  pollIntervalMs?: number;
};

/**
 * Coordinates job storage and scheduling for the engine runtime.
 * Provides a simple API for enqueueing and managing durable background jobs.
 */
export class Jobs {
  private readonly eventBus: EngineEventBus;
  private readonly store: JobStore;
  private readonly scheduler: JobScheduler;

  constructor(options: JobsOptions) {
    this.eventBus = options.eventBus;
    const currentConfig = options.config.current;
    const basePath = path.join(currentConfig.configDir, "jobs");

    this.store = new JobStore(basePath);
    this.scheduler = new JobScheduler({
      config: options.config,
      store: this.store,
      pollIntervalMs: options.pollIntervalMs,
      onJobComplete: (job) => {
        this.eventBus.emit("job.completed", {
          jobId: job.id,
          type: job.type,
          completedAt: job.completedAt
        });
      },
      onJobFailed: (job, error) => {
        this.eventBus.emit("job.failed", {
          jobId: job.id,
          type: job.type,
          attempts: job.attempts,
          error
        });
      },
      onJobDead: (job) => {
        this.eventBus.emit("job.dead", {
          jobId: job.id,
          type: job.type,
          attempts: job.attempts,
          lastError: job.lastError
        });
      }
    });
  }

  async ensureDir(): Promise<void> {
    await this.store.ensureDir();
  }

  async start(): Promise<void> {
    await this.scheduler.start();
    const counts = await this.store.countByStatus();
    this.eventBus.emit("jobs.started", { counts });
    logger.info({ counts }, "start: Jobs system started");
  }

  stop(): void {
    this.scheduler.stop();
  }

  /**
   * Register a handler for a specific job type.
   * The handler will be called when jobs of this type are ready for execution.
   */
  registerHandler(type: string, handler: JobHandler): void {
    this.scheduler.registerHandler(type, handler);
  }

  /**
   * Unregister a handler for a job type.
   */
  unregisterHandler(type: string): void {
    this.scheduler.unregisterHandler(type);
  }

  /**
   * Enqueue a new job for background execution.
   */
  async enqueue(input: JobEnqueueInput): Promise<JobDefinition> {
    const job = await this.store.enqueue(input);
    this.eventBus.emit("job.enqueued", {
      jobId: job.id,
      type: job.type,
      priority: job.priority
    });
    return job;
  }

  /**
   * Get a job by ID.
   */
  async get(jobId: string): Promise<JobDefinition | null> {
    return this.store.get(jobId);
  }

  /**
   * List jobs with optional filtering.
   */
  async list(options?: JobListOptions): Promise<JobDefinition[]> {
    return this.store.list(options);
  }

  /**
   * Cancel a pending job.
   */
  async cancel(jobId: string): Promise<boolean> {
    const cancelled = await this.store.cancel(jobId);
    if (cancelled) {
      this.eventBus.emit("job.cancelled", { jobId });
    }
    return cancelled;
  }

  /**
   * Get job counts by status.
   */
  async countByStatus(): Promise<Record<JobStatus, number>> {
    return this.store.countByStatus();
  }
}
