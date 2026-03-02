import { createId } from "@paralleldrive/cuid2";
import type {
    DelayedSignal,
    DelayedSignalCancelRepeatKeyInput,
    DelayedSignalScheduleInput,
    SignalGenerateInput,
    SignalSource
} from "@/types";
import { getLogger } from "../../log.js";
import type { DelayedSignalDbRecord } from "../../storage/databaseTypes.js";
import type { DelayedSignalsRepository } from "../../storage/delayedSignalsRepository.js";
import { AsyncLock } from "../../utils/lock.js";
import type { ConfigModule } from "../config/configModule.js";
import type { EngineEventBus } from "../ipc/events.js";
import type { Signals } from "./signals.js";

const logger = getLogger("signal.delayed");
type DelayedRuntimeSignal = DelayedSignal & { userId: string };

type DelayedSignalsRepositoryOptions = {
    delayedSignals: Pick<DelayedSignalsRepository, "create" | "findDue" | "findAll" | "delete" | "deleteByRepeatKey">;
};

export type DelayedSignalsOptions = {
    config: ConfigModule;
    eventBus: EngineEventBus;
    signals: Pick<Signals, "generate">;
    failureRetryMs?: number;
    maxTimerMs?: number;
} & DelayedSignalsRepositoryOptions;

/**
 * Manages persistent delayed signal scheduling by wall-time (unix milliseconds).
 * Expects: delayed signals are persisted in SQLite.
 */
export class DelayedSignals {
    private readonly config: ConfigModule;
    private readonly eventBus: EngineEventBus;
    private readonly signals: Pick<Signals, "generate">;
    private readonly delayedSignals: Pick<
        DelayedSignalsRepository,
        "create" | "findDue" | "findAll" | "delete" | "deleteByRepeatKey"
    >;
    private readonly failureRetryMs: number;
    private readonly maxTimerMs: number;
    private readonly lock = new AsyncLock();
    private readonly events = new Map<string, DelayedRuntimeSignal>();
    private loaded = false;
    private timer: NodeJS.Timeout | null = null;
    private started = false;
    private stopped = false;
    private running = false;

    constructor(options: DelayedSignalsOptions) {
        this.config = options.config;
        this.eventBus = options.eventBus;
        this.signals = options.signals;
        this.delayedSignals = options.delayedSignals;
        this.failureRetryMs = Math.max(10, Math.floor(options.failureRetryMs ?? 1_000));
        this.maxTimerMs = Math.max(1_000, Math.floor(options.maxTimerMs ?? 60_000));
    }

    async ensureDir(): Promise<void> {
        await this.lock.inLock(async () => this.loadUnlocked());
    }

    async start(): Promise<void> {
        if (this.started || this.stopped) {
            return;
        }
        await this.ensureDir();
        this.started = true;
        this.scheduleNext(0);
    }

    stop(): void {
        if (this.stopped) {
            return;
        }
        this.stopped = true;
        if (this.timer) {
            clearTimeout(this.timer);
            this.timer = null;
        }
    }

    /**
     * Returns all scheduled delayed signals sorted by wall-time.
     */
    list(): DelayedSignal[] {
        return delayedSignalsSort(Array.from(this.events.values()).map((event) => delayedSignalPublicClone(event)));
    }

    /**
     * Schedules a delayed signal delivery and replaces existing (type + repeatKey) entry.
     * Expects: `deliverAt` is a unix timestamp in milliseconds.
     */
    async schedule(input: DelayedSignalScheduleInput): Promise<DelayedSignal> {
        const normalized = delayedSignalScheduleNormalize(input);
        const now = Date.now();
        const userId = normalized.source.userId;

        const created = await this.lock.inLock(async () => {
            await this.loadUnlocked();

            if (normalized.repeatKey) {
                await this.delayedSignals.deleteByRepeatKey(
                    { agentId: "signal-delayed", userId },
                    normalized.type,
                    normalized.repeatKey
                );
                for (const [delayedId, delayed] of this.events.entries()) {
                    if (
                        delayed.type === normalized.type &&
                        delayed.repeatKey === normalized.repeatKey &&
                        delayed.userId === userId
                    ) {
                        this.events.delete(delayedId);
                    }
                }
            }

            const next: DelayedRuntimeSignal = {
                id: createId(),
                userId,
                type: normalized.type,
                deliverAt: normalized.deliverAt,
                source: normalized.source,
                ...(normalized.data === undefined ? {} : { data: normalized.data }),
                ...(normalized.repeatKey ? { repeatKey: normalized.repeatKey } : {}),
                createdAt: now,
                updatedAt: now
            };
            await this.delayedSignals.create(delayedSignalRecordBuild(next, userId));
            this.events.set(next.id, delayedSignalRuntimeClone(next));
            return delayedSignalPublicClone(next);
        });

        this.eventBus.emit("signal.delayed.scheduled", created);
        this.scheduleNext(0);
        return created;
    }

    /**
     * Removes delayed signals for a specific (type + repeatKey) pair.
     * Returns the number of removed items.
     */
    async cancelByRepeatKey(input: DelayedSignalCancelRepeatKeyInput): Promise<number> {
        const normalized = delayedSignalCancelNormalize(input);
        const removed = await this.lock.inLock(async () => {
            await this.loadUnlocked();
            const targets = Array.from(this.events.values()).filter(
                (entry) => entry.type === normalized.type && entry.repeatKey === normalized.repeatKey
            );
            if (targets.length === 0) {
                return 0;
            }

            let count = 0;
            for (const target of targets) {
                const removedFromDb = await this.delayedSignals.delete(target.id);
                if (removedFromDb) {
                    count += 1;
                }
                this.events.delete(target.id);
            }
            return count;
        });

        if (removed > 0) {
            this.eventBus.emit("signal.delayed.cancelled", {
                type: normalized.type,
                repeatKey: normalized.repeatKey,
                removed
            });
        }
        this.scheduleNext(0);
        return removed;
    }

    private scheduleNext(minimumDelayMs: number): void {
        if (!this.started || this.stopped) {
            return;
        }
        if (this.timer) {
            clearTimeout(this.timer);
            this.timer = null;
        }
        const next = delayedSignalNext(this.events.values());
        if (!next) {
            return;
        }

        const untilDue = Math.max(0, next.deliverAt - Date.now());
        const delay = Math.min(this.maxTimerMs, Math.max(Math.floor(minimumDelayMs), untilDue));
        this.timer = setTimeout(() => {
            this.timer = null;
            void this.tick();
        }, delay);
    }

    private async tick(): Promise<void> {
        if (this.stopped) {
            return;
        }
        if (this.running) {
            this.scheduleNext(this.failureRetryMs);
            return;
        }
        this.running = true;
        let retry = false;
        try {
            retry = await this.config.inReadLock(async () => this.deliverDue());
        } catch (error) {
            retry = true;
            logger.warn({ error }, "error: Delayed signal tick failed");
        } finally {
            this.running = false;
            this.scheduleNext(retry ? this.failureRetryMs : 0);
        }
    }

    private async deliverDue(): Promise<boolean> {
        const now = Date.now();
        const dueRecords = await this.delayedSignals.findDue(now);
        const due = dueRecords.map((record) => delayedSignalRuntimeBuild(record));
        if (due.length === 0) {
            return false;
        }

        let retryNeeded = false;
        for (const delayed of due) {
            const input: SignalGenerateInput = {
                type: delayed.type,
                source: delayed.source,
                ...(delayed.data === undefined ? {} : { data: delayed.data })
            };
            try {
                await this.signals.generate(input);
            } catch (error) {
                retryNeeded = true;
                logger.warn(
                    { delayedSignalId: delayed.id, type: delayed.type, error },
                    "error: Delayed signal delivery failed"
                );
                continue;
            }

            let removed = false;
            await this.lock.inLock(async () => {
                const current = this.events.get(delayed.id);
                if (!current || current.deliverAt > now) {
                    return;
                }
                this.events.delete(delayed.id);
                removed = await this.delayedSignals.delete(delayed.id);
            });

            if (removed) {
                this.eventBus.emit("signal.delayed.delivered", {
                    delayedSignalId: delayed.id,
                    type: delayed.type,
                    repeatKey: delayed.repeatKey ?? null,
                    deliverAt: delayed.deliverAt
                });
            }
        }

        return retryNeeded;
    }

    private async loadUnlocked(): Promise<void> {
        if (this.loaded) {
            return;
        }
        this.loaded = true;
        this.events.clear();

        const records = await this.delayedSignals.findAll();
        for (const record of records) {
            const delayed = delayedSignalRuntimeBuild(record);
            this.events.set(delayed.id, delayedSignalRuntimeClone(delayed));
        }
    }
}

function delayedSignalScheduleNormalize(input: DelayedSignalScheduleInput): {
    type: string;
    deliverAt: number;
    source: SignalSource;
    data?: unknown;
    repeatKey?: string;
} {
    const type = input.type.trim();
    if (!type) {
        throw new Error("Delayed signal type is required");
    }

    if (!Number.isFinite(input.deliverAt)) {
        throw new Error("Delayed signal deliverAt must be a finite unix timestamp");
    }
    const deliverAt = Math.floor(input.deliverAt);
    if (deliverAt < 0) {
        throw new Error("Delayed signal deliverAt must be positive");
    }

    const repeatKey = input.repeatKey?.trim();
    const normalizedRepeatKey = repeatKey && repeatKey.length > 0 ? repeatKey : undefined;

    return {
        type,
        deliverAt,
        source: signalSourceNormalize(input.source),
        data: input.data,
        repeatKey: normalizedRepeatKey
    };
}

function delayedSignalCancelNormalize(input: DelayedSignalCancelRepeatKeyInput): {
    type: string;
    repeatKey: string;
} {
    const type = input.type.trim();
    if (!type) {
        throw new Error("Delayed signal type is required");
    }
    const repeatKey = input.repeatKey.trim();
    if (!repeatKey) {
        throw new Error("Delayed signal repeatKey is required");
    }
    return { type, repeatKey };
}

function signalSourceNormalize(source: SignalSource): SignalSource {
    if (source.type === "system") {
        return { type: "system", userId: signalSourceUserIdNormalize(source.userId) };
    }
    if (source.type === "agent") {
        const id = source.id.trim();
        if (!id) {
            throw new Error("Agent signal source id is required");
        }
        return { type: "agent", id, userId: signalSourceUserIdNormalize(source.userId) };
    }
    if (source.type === "webhook") {
        const id = source.id?.trim();
        const userId = signalSourceUserIdNormalize(source.userId);
        return {
            type: "webhook",
            ...(id ? { id } : {}),
            userId
        };
    }
    if (source.type === "process") {
        const id = source.id?.trim();
        const userId = signalSourceUserIdNormalize(source.userId);
        return {
            type: "process",
            ...(id ? { id } : {}),
            userId
        };
    }
    throw new Error(`Unsupported signal source type: ${(source as { type?: unknown }).type}`);
}

function delayedSignalsSort(events: DelayedSignal[]): DelayedSignal[] {
    return [...events].sort((left, right) => {
        if (left.deliverAt !== right.deliverAt) {
            return left.deliverAt - right.deliverAt;
        }
        if (left.type !== right.type) {
            return left.type.localeCompare(right.type);
        }
        return left.id.localeCompare(right.id);
    });
}

function delayedSignalNext(events: Iterable<DelayedSignal>): DelayedSignal | null {
    let next: DelayedSignal | null = null;
    for (const event of events) {
        if (!next || event.deliverAt < next.deliverAt) {
            next = event;
            continue;
        }
        if (next && event.deliverAt === next.deliverAt && event.id.localeCompare(next.id) < 0) {
            next = event;
        }
    }
    return next;
}

function signalSourceUserIdNormalize(userId: unknown): string {
    if (typeof userId !== "string") {
        throw new Error("Signal source userId is required");
    }
    const normalized = userId.trim();
    if (!normalized) {
        throw new Error("Signal source userId is required");
    }
    return normalized;
}

function delayedSignalRecordBuild(signal: DelayedRuntimeSignal, userId: string): DelayedSignalDbRecord {
    return {
        id: signal.id,
        userId,
        type: signal.type,
        deliverAt: signal.deliverAt,
        source: signal.source,
        data: signal.data,
        repeatKey: signal.repeatKey ?? null,
        createdAt: signal.createdAt,
        updatedAt: signal.updatedAt
    };
}

function delayedSignalRuntimeBuild(record: DelayedSignalDbRecord): DelayedRuntimeSignal {
    return {
        id: record.id,
        userId: record.userId,
        type: record.type,
        deliverAt: record.deliverAt,
        source: record.source,
        ...(record.data === undefined ? {} : { data: record.data }),
        ...(record.repeatKey ? { repeatKey: record.repeatKey } : {}),
        createdAt: record.createdAt,
        updatedAt: record.updatedAt
    };
}

function delayedSignalRuntimeClone(signal: DelayedRuntimeSignal): DelayedRuntimeSignal {
    return {
        ...signal,
        source: JSON.parse(JSON.stringify(signal.source)) as DelayedSignal["source"],
        ...(signal.data === undefined ? {} : { data: JSON.parse(JSON.stringify(signal.data)) as unknown })
    };
}

function delayedSignalPublicClone(signal: DelayedRuntimeSignal): DelayedSignal {
    const base = delayedSignalRuntimeClone(signal);
    const { userId, ...rest } = base;
    void userId;
    return rest;
}
