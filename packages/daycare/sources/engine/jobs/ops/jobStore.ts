import { promises as fs } from "node:fs";
import path from "node:path";

import { createId } from "@paralleldrive/cuid2";
import { z } from "zod";

import { getLogger } from "../../../log.js";
import { atomicWrite } from "../../../util/atomicWrite.js";
import { AsyncLock } from "../../../util/lock.js";
import type {
  JobDefinition,
  JobEnqueueInput,
  JobListOptions,
  JobStatus
} from "../jobTypes.js";

const logger = getLogger("job.store");

const STORE_VERSION = 1;

const jobSchema = z.object({
  id: z.string().min(1),
  type: z.string().min(1),
  payload: z.unknown(),
  priority: z.number().int().nonnegative(),
  status: z.enum(["pending", "running", "completed", "failed", "dead"]),
  attempts: z.number().int().nonnegative(),
  maxAttempts: z.number().int().positive(),
  runAfter: z.number().int().nonnegative(),
  lastError: z.string().nullable(),
  createdAt: z.number().int().nonnegative(),
  updatedAt: z.number().int().nonnegative(),
  completedAt: z.number().int().nonnegative().nullable(),
  agentId: z.string().nullable()
}).strict();

const storeSchema = z.object({
  version: z.literal(STORE_VERSION),
  jobs: z.array(jobSchema)
}).strict();

/**
 * JSON file-based job store with atomic writes and locking.
 * Stores all jobs in a single JSON file for simplicity.
 */
export class JobStore {
  private readonly storePath: string;
  private readonly lock = new AsyncLock();
  private jobs = new Map<string, JobDefinition>();
  private loaded = false;

  constructor(basePath: string) {
    this.storePath = path.join(basePath, "jobs.json");
  }

  async ensureDir(): Promise<void> {
    await fs.mkdir(path.dirname(this.storePath), { recursive: true });
    await this.lock.inLock(async () => this.loadUnlocked());
  }

  async enqueue(input: JobEnqueueInput): Promise<JobDefinition> {
    const type = input.type?.trim();
    if (!type) {
      throw new Error("Job type is required");
    }

    const now = Date.now();
    const job: JobDefinition = {
      id: createId(),
      type,
      payload: input.payload ?? null,
      priority: input.priority ?? 5,
      status: "pending",
      attempts: 0,
      maxAttempts: input.maxAttempts ?? 3,
      runAfter: input.runAfter ?? now,
      lastError: null,
      createdAt: now,
      updatedAt: now,
      completedAt: null,
      agentId: input.agentId ?? null
    };

    await this.lock.inLock(async () => {
      await this.loadUnlocked();
      this.jobs.set(job.id, job);
      await this.persistUnlocked();
    });

    logger.info({ jobId: job.id, type: job.type }, "enqueue: Job enqueued");
    return { ...job };
  }

  async get(jobId: string): Promise<JobDefinition | null> {
    return this.lock.inLock(async () => {
      await this.loadUnlocked();
      const job = this.jobs.get(jobId);
      return job ? { ...job } : null;
    });
  }

  async list(options?: JobListOptions): Promise<JobDefinition[]> {
    return this.lock.inLock(async () => {
      await this.loadUnlocked();
      let jobs = Array.from(this.jobs.values());

      // Filter by status
      if (options?.status) {
        const statuses = Array.isArray(options.status)
          ? options.status
          : [options.status];
        jobs = jobs.filter((job) => statuses.includes(job.status));
      }

      // Filter by type
      if (options?.type) {
        jobs = jobs.filter((job) => job.type === options.type);
      }

      // Sort by priority (ascending), then runAfter (ascending), then createdAt
      jobs.sort((a, b) => {
        if (a.priority !== b.priority) return a.priority - b.priority;
        if (a.runAfter !== b.runAfter) return a.runAfter - b.runAfter;
        return a.createdAt - b.createdAt;
      });

      // Apply pagination
      const offset = options?.offset ?? 0;
      const limit = options?.limit ?? jobs.length;
      jobs = jobs.slice(offset, offset + limit);

      return jobs.map((job) => ({ ...job }));
    });
  }

  /**
   * Atomically claim the next available job for processing.
   * Returns null if no jobs are ready.
   */
  async claimNext(now: number = Date.now()): Promise<JobDefinition | null> {
    return this.lock.inLock(async () => {
      await this.loadUnlocked();

      // Find pending jobs that are ready to run
      const readyJobs = Array.from(this.jobs.values())
        .filter((job) => job.status === "pending" && job.runAfter <= now)
        .sort((a, b) => {
          if (a.priority !== b.priority) return a.priority - b.priority;
          if (a.runAfter !== b.runAfter) return a.runAfter - b.runAfter;
          return a.createdAt - b.createdAt;
        });

      if (readyJobs.length === 0) {
        return null;
      }

      const job = readyJobs[0];
      if (!job) {
        return null;
      }

      // Claim the job
      job.status = "running";
      job.attempts += 1;
      job.updatedAt = now;

      await this.persistUnlocked();

      logger.debug(
        { jobId: job.id, type: job.type, attempt: job.attempts },
        "claim: Job claimed"
      );

      return { ...job };
    });
  }

  /**
   * Mark a job as completed successfully.
   */
  async complete(jobId: string, now: number = Date.now()): Promise<void> {
    await this.lock.inLock(async () => {
      await this.loadUnlocked();
      const job = this.jobs.get(jobId);
      if (!job) {
        logger.warn({ jobId }, "complete: Job not found");
        return;
      }

      job.status = "completed";
      job.completedAt = now;
      job.updatedAt = now;

      await this.persistUnlocked();
    });

    logger.info({ jobId }, "complete: Job completed");
  }

  /**
   * Mark a job as failed. If max attempts reached, mark as dead.
   */
  async fail(
    jobId: string,
    error: string,
    backoffMs: number,
    now: number = Date.now()
  ): Promise<JobDefinition | null> {
    return this.lock.inLock(async () => {
      await this.loadUnlocked();
      const job = this.jobs.get(jobId);
      if (!job) {
        logger.warn({ jobId }, "fail: Job not found");
        return null;
      }

      const isDead = job.attempts >= job.maxAttempts;
      job.status = isDead ? "dead" : "pending";
      job.lastError = error;
      job.runAfter = isDead ? job.runAfter : now + backoffMs;
      job.updatedAt = now;

      await this.persistUnlocked();

      logger.info(
        { jobId, type: job.type, status: job.status, attempts: job.attempts },
        `fail: Job ${isDead ? "marked dead" : "scheduled for retry"}`
      );

      return { ...job };
    });
  }

  /**
   * Cancel a pending job.
   */
  async cancel(jobId: string): Promise<boolean> {
    return this.lock.inLock(async () => {
      await this.loadUnlocked();
      const job = this.jobs.get(jobId);
      if (!job || job.status !== "pending") {
        return false;
      }

      this.jobs.delete(jobId);
      await this.persistUnlocked();

      logger.info({ jobId }, "cancel: Job cancelled");
      return true;
    });
  }

  /**
   * Delete completed/dead jobs older than a given timestamp.
   */
  async prune(olderThan: number): Promise<number> {
    return this.lock.inLock(async () => {
      await this.loadUnlocked();
      let count = 0;

      for (const [jobId, job] of this.jobs) {
        if (
          (job.status === "completed" || job.status === "dead") &&
          job.updatedAt < olderThan
        ) {
          this.jobs.delete(jobId);
          count += 1;
        }
      }

      if (count > 0) {
        await this.persistUnlocked();
        logger.info({ pruned: count }, "prune: Old jobs removed");
      }

      return count;
    });
  }

  /**
   * Count jobs by status.
   */
  async countByStatus(): Promise<Record<JobStatus, number>> {
    return this.lock.inLock(async () => {
      await this.loadUnlocked();
      const counts: Record<JobStatus, number> = {
        pending: 0,
        running: 0,
        completed: 0,
        failed: 0,
        dead: 0
      };

      for (const job of this.jobs.values()) {
        counts[job.status] = (counts[job.status] ?? 0) + 1;
      }

      return counts;
    });
  }

  /**
   * Reset any running jobs back to pending (for recovery after crash).
   */
  async recoverRunningJobs(): Promise<number> {
    return this.lock.inLock(async () => {
      await this.loadUnlocked();
      const now = Date.now();
      let count = 0;

      for (const job of this.jobs.values()) {
        if (job.status === "running") {
          job.status = "pending";
          job.updatedAt = now;
          count += 1;
        }
      }

      if (count > 0) {
        await this.persistUnlocked();
        logger.info({ recovered: count }, "recover: Running jobs reset to pending");
      }

      return count;
    });
  }

  private async loadUnlocked(): Promise<void> {
    if (this.loaded) {
      return;
    }
    this.loaded = true;

    try {
      const raw = await fs.readFile(this.storePath, "utf8");
      const parsed = storeSchema.parse(JSON.parse(raw));
      this.jobs.clear();
      for (const job of parsed.jobs) {
        this.jobs.set(job.id, job as JobDefinition);
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        this.jobs.clear();
        return;
      }
      logger.warn({ error }, "error: Failed to load job store, starting fresh");
      this.jobs.clear();
    }
  }

  private async persistUnlocked(): Promise<void> {
    const jobs = Array.from(this.jobs.values()).sort(
      (a, b) => a.createdAt - b.createdAt
    );
    const payload = {
      version: STORE_VERSION as typeof STORE_VERSION,
      jobs
    };
    await atomicWrite(this.storePath, `${JSON.stringify(payload, null, 2)}\n`);
  }
}
