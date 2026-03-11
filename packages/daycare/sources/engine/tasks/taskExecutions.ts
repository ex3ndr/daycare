import { getLogger } from "../../log.js";
import type { TaskExecutionDispatchInput, TaskExecutionRunner, TaskExecutionSource } from "./taskExecutionRunner.js";

const logger = getLogger("task.executions");

export type TaskExecutionCounters = {
    queued: number;
    succeeded: number;
    failed: number;
    lastQueuedAt: number | null;
    lastSucceededAt: number | null;
    lastFailedAt: number | null;
};

export type TaskExecutionStats = {
    userId: string;
    taskId: string;
    total: TaskExecutionCounters;
    sources: Record<TaskExecutionSource, TaskExecutionCounters>;
};

export type TaskExecutionsOptions = {
    runner: TaskExecutionRunner;
};

type MutableTaskExecutionStats = {
    userId: string;
    taskId: string;
    total: TaskExecutionCounters;
    sources: Record<TaskExecutionSource, TaskExecutionCounters>;
};

/**
 * Central facade for task dispatch bookkeeping.
 * Expects: execution side effects happen inside TaskExecutionRunner.
 */
export class TaskExecutions {
    private readonly runner: TaskExecutionRunner;
    private readonly stats = new Map<string, MutableTaskExecutionStats>();

    constructor(options: TaskExecutionsOptions) {
        this.runner = options.runner;
    }

    /**
     * Dispatches task code asynchronously and records counters after completion.
     */
    dispatch(input: TaskExecutionDispatchInput): void {
        const prepared = taskExecutionStatsPrepare(input);
        const stats = this.statsQueueRecord(prepared.userId, prepared.taskId, prepared.source);
        void this.runner
            .runAndAwait(input)
            .then((result) => {
                if (result.errorMessage) {
                    this.statsFailureRecord(stats, prepared.source);
                    return;
                }
                this.statsSuccessRecord(stats, prepared.source);
            })
            .catch((error) => {
                this.statsFailureRecord(stats, prepared.source);
                logger.warn(
                    { userId: prepared.userId, taskId: prepared.taskId, source: prepared.source, error },
                    "error: Fire-and-forget task execution failed"
                );
            });
    }

    /**
     * Dispatches task code and waits for completion.
     * Expects: caller needs direct execution output for sync/manual flows.
     */
    async dispatchAndAwait(input: TaskExecutionDispatchInput): Promise<{
        type: "system_message";
        responseText: string | null;
        responseError?: boolean;
        executionErrorText?: string;
    }> {
        const prepared = taskExecutionStatsPrepare(input);
        const stats = this.statsQueueRecord(prepared.userId, prepared.taskId, prepared.source);
        try {
            const result = await this.runner.runAndAwait(input);
            if (result.errorMessage) {
                this.statsFailureRecord(stats, prepared.source);
            } else {
                this.statsSuccessRecord(stats, prepared.source);
            }
            return {
                type: "system_message",
                responseText: result.output,
                ...(result.errorMessage ? { responseError: true, executionErrorText: result.errorMessage } : {})
            };
        } catch (error) {
            this.statsFailureRecord(stats, prepared.source);
            throw error;
        }
    }

    /**
     * Returns a stable snapshot of per-task execution counters.
     */
    listStats(): TaskExecutionStats[] {
        return Array.from(this.stats.values())
            .map((entry) => ({
                userId: entry.userId,
                taskId: entry.taskId,
                total: countersClone(entry.total),
                sources: {
                    cron: countersClone(entry.sources.cron),
                    webhook: countersClone(entry.sources.webhook),
                    manual: countersClone(entry.sources.manual)
                }
            }))
            .sort((left, right) => {
                if (left.userId === right.userId) {
                    return left.taskId.localeCompare(right.taskId);
                }
                return left.userId.localeCompare(right.userId);
            });
    }

    /**
     * Returns aggregate execution counters across all tracked tasks.
     */
    summary(): TaskExecutionCounters {
        const counters = countersCreate();
        for (const entry of this.stats.values()) {
            counters.queued += entry.total.queued;
            counters.succeeded += entry.total.succeeded;
            counters.failed += entry.total.failed;
            counters.lastQueuedAt = maxTimestamp(counters.lastQueuedAt, entry.total.lastQueuedAt);
            counters.lastSucceededAt = maxTimestamp(counters.lastSucceededAt, entry.total.lastSucceededAt);
            counters.lastFailedAt = maxTimestamp(counters.lastFailedAt, entry.total.lastFailedAt);
        }
        return counters;
    }

    private statsQueueRecord(userId: string, taskId: string, source: TaskExecutionSource): MutableTaskExecutionStats {
        const entry = this.statsEntryResolve(userId, taskId);
        const now = Date.now();
        countersQueueIncrement(entry.total, now);
        countersQueueIncrement(entry.sources[source], now);
        return entry;
    }

    private statsSuccessRecord(entry: MutableTaskExecutionStats | null, source: TaskExecutionSource): void {
        if (!entry) {
            return;
        }
        const now = Date.now();
        countersSuccessIncrement(entry.total, now);
        countersSuccessIncrement(entry.sources[source], now);
    }

    private statsFailureRecord(entry: MutableTaskExecutionStats | null, source: TaskExecutionSource): void {
        if (!entry) {
            return;
        }
        const now = Date.now();
        countersFailureIncrement(entry.total, now);
        countersFailureIncrement(entry.sources[source], now);
    }

    private statsEntryResolve(userId: string, taskId: string): MutableTaskExecutionStats {
        const key = `${userId}:${taskId}`;
        const existing = this.stats.get(key);
        if (existing) {
            return existing;
        }
        const created: MutableTaskExecutionStats = {
            userId,
            taskId,
            total: countersCreate(),
            sources: {
                cron: countersCreate(),
                webhook: countersCreate(),
                manual: countersCreate()
            }
        };
        this.stats.set(key, created);
        return created;
    }
}

function taskExecutionStatsPrepare(input: TaskExecutionDispatchInput): {
    userId: string;
    taskId: string;
    source: TaskExecutionSource;
} {
    const userId = input.userId.trim();
    if (!userId) {
        throw new Error("Task execution userId is required.");
    }
    const taskId = input.taskId.trim();
    if (!taskId) {
        throw new Error("Task execution taskId is required.");
    }
    return {
        userId,
        taskId,
        source: input.source
    };
}

function countersCreate(): TaskExecutionCounters {
    return {
        queued: 0,
        succeeded: 0,
        failed: 0,
        lastQueuedAt: null,
        lastSucceededAt: null,
        lastFailedAt: null
    };
}

function countersClone(counters: TaskExecutionCounters): TaskExecutionCounters {
    return { ...counters };
}

function countersQueueIncrement(counters: TaskExecutionCounters, now: number): void {
    counters.queued += 1;
    counters.lastQueuedAt = now;
}

function countersSuccessIncrement(counters: TaskExecutionCounters, now: number): void {
    counters.succeeded += 1;
    counters.lastSucceededAt = now;
}

function countersFailureIncrement(counters: TaskExecutionCounters, now: number): void {
    counters.failed += 1;
    counters.lastFailedAt = now;
}

function maxTimestamp(left: number | null, right: number | null): number | null {
    if (left === null) {
        return right;
    }
    if (right === null) {
        return left;
    }
    return Math.max(left, right);
}
