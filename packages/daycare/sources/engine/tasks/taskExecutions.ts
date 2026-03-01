import type { AgentCreationConfig, MessageContext } from "@/types";
import { getLogger } from "../../log.js";
import type { AgentSystem } from "../agents/agentSystem.js";
import { contextForUser } from "../agents/context.js";
import type { AgentPostTarget } from "../agents/ops/agentTypes.js";

const logger = getLogger("task.executions");
const TASK_EXECUTION_SOURCES = ["cron", "webhook", "manual"] as const;

export type TaskExecutionSource = (typeof TASK_EXECUTION_SOURCES)[number];

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

export type TaskExecutionDispatchInput = {
    userId: string;
    taskId: string;
    target: AgentPostTarget;
    text: string;
    source: TaskExecutionSource;
    taskVersion?: number | null;
    origin?: string;
    parameters?: Record<string, unknown>;
    context?: MessageContext;
    sync?: boolean;
    creationConfig?: AgentCreationConfig;
};

export type TaskExecutionsOptions = {
    agentSystem: AgentSystem;
};

type MutableTaskExecutionStats = {
    userId: string;
    taskId: string;
    total: TaskExecutionCounters;
    sources: Record<TaskExecutionSource, TaskExecutionCounters>;
};

/**
 * Central facade for task execution dispatch and aggregated execution counters.
 * Expects: fire-and-forget dispatches may complete later and update success/failure stats asynchronously.
 */
export class TaskExecutions {
    private readonly agentSystem: AgentSystem;
    private readonly stats = new Map<string, MutableTaskExecutionStats>();

    constructor(options: TaskExecutionsOptions) {
        this.agentSystem = options.agentSystem;
    }

    /**
     * Dispatches task code asynchronously via the common system_message path.
     * Returns immediately; completion is tracked in the internal stats map.
     */
    dispatch(input: TaskExecutionDispatchInput): void {
        const prepared = taskExecutionPrepare(input);
        const stats = this.statsQueueRecord(prepared.userId, prepared.taskId, prepared.source);
        const item = taskExecutionItemBuild(prepared);
        const ctx = contextForUser({ userId: prepared.userId });
        void this.agentSystem
            .postAndAwait(ctx, prepared.target, item, prepared.creationConfig)
            .then((result) => {
                if (result.type !== "system_message") {
                    this.statsFailureRecord(stats, prepared.source);
                    logger.warn(
                        { userId: prepared.userId, taskId: prepared.taskId, resultType: result.type },
                        "error: Unexpected task execution result type"
                    );
                    return;
                }
                if (result.responseError) {
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
        const prepared = taskExecutionPrepare(input);
        const stats = this.statsQueueRecord(prepared.userId, prepared.taskId, prepared.source);
        try {
            const item = taskExecutionItemBuild(prepared);
            const result = await this.agentSystem.postAndAwait(
                contextForUser({ userId: prepared.userId }),
                prepared.target,
                item,
                prepared.creationConfig
            );
            if (result.type !== "system_message") {
                this.statsFailureRecord(stats, prepared.source);
                throw new Error(`Unexpected task execution result type: ${result.type}`);
            }
            if (result.responseError) {
                this.statsFailureRecord(stats, prepared.source);
            } else {
                this.statsSuccessRecord(stats, prepared.source);
            }
            return result;
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

function taskExecutionPrepare(input: TaskExecutionDispatchInput): {
    userId: string;
    target: AgentPostTarget;
    text: string;
    source: TaskExecutionSource;
    origin: string;
    taskId: string;
    taskVersion: number | null;
    parameters?: Record<string, unknown>;
    context?: MessageContext;
    sync: boolean;
    creationConfig?: AgentCreationConfig;
} {
    const userId = input.userId.trim();
    if (!userId) {
        throw new Error("Task execution userId is required.");
    }
    const taskId = input.taskId.trim();
    if (!taskId) {
        throw new Error("Task execution taskId is required.");
    }
    const taskVersion =
        typeof input.taskVersion === "number" && Number.isFinite(input.taskVersion) && input.taskVersion > 0
            ? Math.trunc(input.taskVersion)
            : null;
    return {
        userId,
        target: input.target,
        text: input.text,
        source: input.source,
        origin: input.origin?.trim() || input.source,
        taskId,
        taskVersion,
        parameters: input.parameters,
        context: input.context,
        sync: input.sync === true,
        creationConfig: input.creationConfig
    };
}

function taskExecutionItemBuild(input: ReturnType<typeof taskExecutionPrepare>) {
    return {
        type: "system_message" as const,
        text: input.text,
        task: {
            id: input.taskId,
            ...(input.taskVersion !== null ? { version: input.taskVersion } : {})
        },
        origin: input.origin,
        sync: input.sync,
        taskId: input.taskId,
        ...(input.parameters ? { inputs: input.parameters } : {}),
        ...(input.context ? { context: input.context } : {})
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
