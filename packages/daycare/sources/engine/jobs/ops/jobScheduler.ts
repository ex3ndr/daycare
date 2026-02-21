import { getLogger } from "../../../log.js";
import { AsyncLock } from "../../../util/lock.js";
import type { ConfigModule } from "../../config/configModule.js";
import type { JobStore } from "./jobStore.js";
import type { JobDefinition, JobHandler, JobResult } from "../jobTypes.js";

const logger = getLogger("job.scheduler");

const DEFAULT_POLL_INTERVAL_MS = 5_000;
const DEFAULT_RETRY_BACKOFF_BASE_MS = 1_000;
const DEFAULT_RETRY_BACKOFF_MAX_MS = 300_000; // 5 minutes
const DEFAULT_PRUNE_INTERVAL_MS = 3600_000; // 1 hour
const DEFAULT_PRUNE_AGE_MS = 86400_000; // 24 hours

export type JobSchedulerOptions = {
  config: ConfigModule;
  store: JobStore;
  pollIntervalMs?: number;
  retryBackoffBaseMs?: number;
  retryBackoffMaxMs?: number;
  pruneIntervalMs?: number;
  pruneAgeMs?: number;
  onJobComplete?: (job: JobDefinition) => void;
  onJobFailed?: (job: JobDefinition, error: string) => void;
  onJobDead?: (job: JobDefinition) => void;
};

/**
 * Background worker that polls for and executes jobs from the store.
 * Supports pluggable job handlers registered by type.
 */
export class JobScheduler {
  private readonly config: ConfigModule;
  private readonly store: JobStore;
  private readonly pollIntervalMs: number;
  private readonly retryBackoffBaseMs: number;
  private readonly retryBackoffMaxMs: number;
  private readonly pruneIntervalMs: number;
  private readonly pruneAgeMs: number;
  private readonly onJobComplete?: (job: JobDefinition) => void;
  private readonly onJobFailed?: (job: JobDefinition, error: string) => void;
  private readonly onJobDead?: (job: JobDefinition) => void;

  private readonly handlers = new Map<string, JobHandler>();
  private readonly lock = new AsyncLock();
  private pollTimer: NodeJS.Timeout | null = null;
  private pruneTimer: NodeJS.Timeout | null = null;
  private started = false;
  private stopped = false;
  private processing = false;

  constructor(options: JobSchedulerOptions) {
    this.config = options.config;
    this.store = options.store;
    this.pollIntervalMs = options.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
    this.retryBackoffBaseMs = options.retryBackoffBaseMs ?? DEFAULT_RETRY_BACKOFF_BASE_MS;
    this.retryBackoffMaxMs = options.retryBackoffMaxMs ?? DEFAULT_RETRY_BACKOFF_MAX_MS;
    this.pruneIntervalMs = options.pruneIntervalMs ?? DEFAULT_PRUNE_INTERVAL_MS;
    this.pruneAgeMs = options.pruneAgeMs ?? DEFAULT_PRUNE_AGE_MS;
    this.onJobComplete = options.onJobComplete;
    this.onJobFailed = options.onJobFailed;
    this.onJobDead = options.onJobDead;
  }

  /**
   * Register a handler for a specific job type.
   */
  registerHandler(type: string, handler: JobHandler): void {
    this.handlers.set(type, handler);
    logger.debug({ type }, "register: Job handler registered");
  }

  /**
   * Unregister a handler for a job type.
   */
  unregisterHandler(type: string): void {
    this.handlers.delete(type);
    logger.debug({ type }, "unregister: Job handler unregistered");
  }

  /**
   * Start the scheduler. Recovers any running jobs from a previous crash.
   */
  async start(): Promise<void> {
    if (this.started || this.stopped) {
      return;
    }
    this.started = true;

    // Recover any jobs that were running when we crashed
    const recovered = await this.store.recoverRunningJobs();
    if (recovered > 0) {
      logger.info({ recovered }, "start: Recovered running jobs from previous session");
    }

    this.schedulePoll(0);
    this.schedulePrune();
    logger.info("start: Job scheduler started");
  }

  /**
   * Stop the scheduler gracefully.
   */
  stop(): void {
    if (this.stopped) {
      return;
    }
    this.stopped = true;

    if (this.pollTimer) {
      clearTimeout(this.pollTimer);
      this.pollTimer = null;
    }
    if (this.pruneTimer) {
      clearInterval(this.pruneTimer);
      this.pruneTimer = null;
    }

    logger.info("stop: Job scheduler stopped");
  }

  private schedulePoll(delayMs: number): void {
    if (this.stopped) {
      return;
    }
    if (this.pollTimer) {
      clearTimeout(this.pollTimer);
    }
    this.pollTimer = setTimeout(() => {
      this.pollTimer = null;
      void this.poll();
    }, delayMs);
  }

  private schedulePrune(): void {
    if (this.stopped) {
      return;
    }
    this.pruneTimer = setInterval(() => {
      void this.prune();
    }, this.pruneIntervalMs);
    this.pruneTimer.unref();
  }

  private async poll(): Promise<void> {
    if (this.stopped) {
      return;
    }
    if (this.processing) {
      this.schedulePoll(this.pollIntervalMs);
      return;
    }

    this.processing = true;
    let processedAny = false;

    try {
      // Process jobs while there are ready ones available
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition, no-constant-condition
      while (true) {
        if (this.stopped) {
          break;
        }

        const job = await this.store.claimNext();
        if (!job) {
          break;
        }

        processedAny = true;
        await this.executeJob(job);
      }
    } catch (error) {
      logger.warn({ error }, "error: Poll cycle failed");
    } finally {
      this.processing = false;
      // Poll again immediately if we processed jobs (might be more), otherwise wait
      this.schedulePoll(processedAny ? 0 : this.pollIntervalMs);
    }
  }

  private async executeJob(job: JobDefinition): Promise<void> {
    const handler = this.handlers.get(job.type);
    if (!handler) {
      logger.warn(
        { jobId: job.id, type: job.type },
        "execute: No handler registered for job type, marking as failed"
      );
      await this.handleFailure(job, `No handler registered for job type: ${job.type}`);
      return;
    }

    try {
      // Execute within config read lock to respect runtime reload behavior
      const result = await this.config.inReadLock(async () => {
        return handler(job);
      });

      if (result.success) {
        await this.store.complete(job.id);
        this.onJobComplete?.(job);
        logger.info(
          { jobId: job.id, type: job.type },
          "execute: Job completed successfully"
        );
      } else {
        await this.handleFailure(job, result.error ?? "Handler returned failure");
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.warn(
        { jobId: job.id, type: job.type, error: errorMessage },
        "execute: Job handler threw error"
      );
      await this.handleFailure(job, errorMessage);
    }
  }

  private async handleFailure(job: JobDefinition, error: string): Promise<void> {
    const backoffMs = this.calculateBackoff(job.attempts);
    const updated = await this.store.fail(job.id, error, backoffMs);

    if (!updated) {
      return;
    }

    if (updated.status === "dead") {
      this.onJobDead?.(updated);
      logger.warn(
        { jobId: job.id, type: job.type, attempts: job.attempts },
        "execute: Job marked as dead after max attempts"
      );
    } else {
      this.onJobFailed?.(updated, error);
      logger.info(
        { jobId: job.id, type: job.type, attempts: job.attempts, nextRunAfter: updated.runAfter },
        "execute: Job failed, scheduled for retry"
      );
    }
  }

  private calculateBackoff(attempt: number): number {
    // Exponential backoff with jitter
    const baseDelay = this.retryBackoffBaseMs * Math.pow(2, attempt - 1);
    const jitter = Math.random() * 0.3 * baseDelay; // Up to 30% jitter
    return Math.min(baseDelay + jitter, this.retryBackoffMaxMs);
  }

  private async prune(): Promise<void> {
    try {
      const olderThan = Date.now() - this.pruneAgeMs;
      const pruned = await this.store.prune(olderThan);
      if (pruned > 0) {
        logger.debug({ pruned }, "prune: Old jobs cleaned up");
      }
    } catch (error) {
      logger.warn({ error }, "error: Prune cycle failed");
    }
  }
}
