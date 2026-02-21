/**
 * Job queue types for durable background task execution.
 */

export type JobStatus = "pending" | "running" | "completed" | "failed" | "dead";

export type JobPriority = number; // 0 = highest priority, higher numbers = lower priority

export interface JobDefinition {
  id: string;
  type: string;
  payload: unknown;
  priority: JobPriority;
  status: JobStatus;
  attempts: number;
  maxAttempts: number;
  runAfter: number; // unix ms - don't run before this time
  lastError: string | null;
  createdAt: number;
  updatedAt: number;
  completedAt: number | null;
  agentId: string | null; // agent that created the job
}

export interface JobEnqueueInput {
  type: string;
  payload?: unknown;
  priority?: JobPriority;
  maxAttempts?: number;
  runAfter?: number; // unix ms - delay execution until this time
  agentId?: string;
}

export interface JobListOptions {
  status?: JobStatus | JobStatus[];
  type?: string;
  limit?: number;
  offset?: number;
}

export interface JobResult {
  success: boolean;
  error?: string;
  data?: unknown;
}

/**
 * Job handler function signature.
 * Receives job definition and returns result.
 * Throwing an error marks the job as failed for retry.
 */
export type JobHandler = (job: JobDefinition) => Promise<JobResult>;
