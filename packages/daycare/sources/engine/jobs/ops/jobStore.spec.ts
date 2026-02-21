import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import path from "node:path";
import os from "node:os";

import { JobStore } from "./jobStore.js";

describe("JobStore", () => {
  let tempDir: string;
  let store: JobStore;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), "job-store-test-"));
    store = new JobStore(tempDir);
    await store.ensureDir();
  });

  afterEach(async () => {
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe("enqueue", () => {
    it("should enqueue a job with required fields", async () => {
      const job = await store.enqueue({ type: "test-job" });

      expect(job.id).toBeDefined();
      expect(job.type).toBe("test-job");
      expect(job.status).toBe("pending");
      expect(job.priority).toBe(5);
      expect(job.attempts).toBe(0);
      expect(job.maxAttempts).toBe(3);
    });

    it("should enqueue a job with custom options", async () => {
      const now = Date.now();
      const job = await store.enqueue({
        type: "custom-job",
        payload: { foo: "bar" },
        priority: 1,
        maxAttempts: 5,
        runAfter: now + 60000,
        agentId: "agent-123"
      });

      expect(job.type).toBe("custom-job");
      expect(job.payload).toEqual({ foo: "bar" });
      expect(job.priority).toBe(1);
      expect(job.maxAttempts).toBe(5);
      expect(job.runAfter).toBe(now + 60000);
      expect(job.agentId).toBe("agent-123");
    });

    it("should throw if type is empty", async () => {
      await expect(store.enqueue({ type: "  " })).rejects.toThrow("Job type is required");
    });
  });

  describe("get", () => {
    it("should return null for non-existent job", async () => {
      const job = await store.get("non-existent");
      expect(job).toBeNull();
    });

    it("should return the job if it exists", async () => {
      const enqueued = await store.enqueue({ type: "test-job" });
      const fetched = await store.get(enqueued.id);

      expect(fetched).toEqual(enqueued);
    });
  });

  describe("list", () => {
    it("should return empty array when no jobs", async () => {
      const jobs = await store.list();
      expect(jobs).toEqual([]);
    });

    it("should return all jobs sorted by priority", async () => {
      await store.enqueue({ type: "low-priority", priority: 10 });
      await store.enqueue({ type: "high-priority", priority: 1 });
      await store.enqueue({ type: "medium-priority", priority: 5 });

      const jobs = await store.list();

      expect(jobs).toHaveLength(3);
      expect(jobs[0]?.type).toBe("high-priority");
      expect(jobs[1]?.type).toBe("medium-priority");
      expect(jobs[2]?.type).toBe("low-priority");
    });

    it("should filter by status", async () => {
      const job = await store.enqueue({ type: "test-job" });
      await store.complete(job.id);

      const pending = await store.list({ status: "pending" });
      const completed = await store.list({ status: "completed" });

      expect(pending).toHaveLength(0);
      expect(completed).toHaveLength(1);
    });

    it("should filter by type", async () => {
      await store.enqueue({ type: "type-a" });
      await store.enqueue({ type: "type-b" });
      await store.enqueue({ type: "type-a" });

      const typeA = await store.list({ type: "type-a" });
      const typeB = await store.list({ type: "type-b" });

      expect(typeA).toHaveLength(2);
      expect(typeB).toHaveLength(1);
    });

    it("should respect limit", async () => {
      await store.enqueue({ type: "job-1" });
      await store.enqueue({ type: "job-2" });
      await store.enqueue({ type: "job-3" });

      const limited = await store.list({ limit: 2 });

      expect(limited).toHaveLength(2);
    });
  });

  describe("claimNext", () => {
    it("should return null when no pending jobs", async () => {
      const job = await store.claimNext();
      expect(job).toBeNull();
    });

    it("should claim the highest priority job", async () => {
      await store.enqueue({ type: "low-priority", priority: 10 });
      await store.enqueue({ type: "high-priority", priority: 1 });

      const claimed = await store.claimNext();

      expect(claimed?.type).toBe("high-priority");
      expect(claimed?.status).toBe("running");
      expect(claimed?.attempts).toBe(1);
    });

    it("should not claim jobs with future runAfter", async () => {
      const futureTime = Date.now() + 60000;
      await store.enqueue({ type: "future-job", runAfter: futureTime });

      const claimed = await store.claimNext();

      expect(claimed).toBeNull();
    });

    it("should claim jobs with past runAfter", async () => {
      const pastTime = Date.now() - 1000;
      await store.enqueue({ type: "past-job", runAfter: pastTime });

      const claimed = await store.claimNext();

      expect(claimed?.type).toBe("past-job");
    });
  });

  describe("complete", () => {
    it("should mark job as completed", async () => {
      const job = await store.enqueue({ type: "test-job" });
      await store.complete(job.id);

      const updated = await store.get(job.id);

      expect(updated?.status).toBe("completed");
      expect(updated?.completedAt).toBeDefined();
    });
  });

  describe("fail", () => {
    it("should mark job as pending with backoff", async () => {
      const job = await store.enqueue({ type: "test-job", maxAttempts: 3 });
      const claimed = await store.claimNext();
      const failed = await store.fail(claimed!.id, "Test error", 5000);

      expect(failed?.status).toBe("pending");
      expect(failed?.lastError).toBe("Test error");
      expect(failed?.runAfter).toBeGreaterThan(Date.now());
    });

    it("should mark job as dead after max attempts", async () => {
      const job = await store.enqueue({ type: "test-job", maxAttempts: 1 });
      await store.claimNext();
      const failed = await store.fail(job.id, "Final error", 0);

      expect(failed?.status).toBe("dead");
    });
  });

  describe("cancel", () => {
    it("should cancel pending job", async () => {
      const job = await store.enqueue({ type: "test-job" });
      const cancelled = await store.cancel(job.id);

      expect(cancelled).toBe(true);

      const fetched = await store.get(job.id);
      expect(fetched).toBeNull();
    });

    it("should not cancel running job", async () => {
      const job = await store.enqueue({ type: "test-job" });
      await store.claimNext();

      const cancelled = await store.cancel(job.id);

      expect(cancelled).toBe(false);
    });
  });

  describe("prune", () => {
    it("should remove old completed jobs", async () => {
      const job = await store.enqueue({ type: "test-job" });
      await store.complete(job.id);

      // Prune with future timestamp to catch all
      const pruned = await store.prune(Date.now() + 1000);

      expect(pruned).toBe(1);

      const fetched = await store.get(job.id);
      expect(fetched).toBeNull();
    });

    it("should not remove pending jobs", async () => {
      await store.enqueue({ type: "test-job" });

      const pruned = await store.prune(Date.now() + 1000);

      expect(pruned).toBe(0);
    });
  });

  describe("recoverRunningJobs", () => {
    it("should reset running jobs to pending", async () => {
      const job = await store.enqueue({ type: "test-job" });
      await store.claimNext();

      const recovered = await store.recoverRunningJobs();

      expect(recovered).toBe(1);

      const updated = await store.get(job.id);
      expect(updated?.status).toBe("pending");
    });
  });

  describe("persistence", () => {
    it("should persist and reload jobs", async () => {
      await store.enqueue({ type: "test-job", payload: { key: "value" } });

      // Create new store instance pointing to same path
      const newStore = new JobStore(tempDir);
      await newStore.ensureDir();

      const jobs = await newStore.list();

      expect(jobs).toHaveLength(1);
      expect(jobs[0]?.type).toBe("test-job");
      expect(jobs[0]?.payload).toEqual({ key: "value" });
    });
  });
});
