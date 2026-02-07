import { promises as fs } from "node:fs";
import path from "node:path";

import { createId } from "@paralleldrive/cuid2";
import { z } from "zod";

import { getLogger } from "../../log.js";
import { atomicWrite } from "../../util/atomicWrite.js";
import { AsyncLock } from "../../util/lock.js";
import type { ConfigModule } from "../config/configModule.js";
import type { EngineEventBus } from "../ipc/events.js";
import type { Signals } from "./signals.js";
import type {
  DelayedSignal,
  DelayedSignalCancelRepeatKeyInput,
  DelayedSignalScheduleInput,
  SignalGenerateInput,
  SignalSource
} from "@/types";

const logger = getLogger("signal.delayed");

const sourceSchema = z.discriminatedUnion("type", [
  z
    .object({
      type: z.literal("system")
    })
    .strict(),
  z
    .object({
      type: z.literal("agent"),
      id: z.string().min(1)
    })
    .strict(),
  z
    .object({
      type: z.literal("webhook"),
      id: z.string().min(1).optional()
    })
    .strict(),
  z
    .object({
      type: z.literal("process"),
      id: z.string().min(1).optional()
    })
    .strict()
]);

const delayedSignalSchema = z
  .object({
    id: z.string().min(1),
    type: z.string().min(1),
    deliverAt: z.number().int().nonnegative(),
    source: sourceSchema,
    data: z.unknown().optional(),
    repeatKey: z.string().min(1).optional(),
    createdAt: z.number().int().nonnegative(),
    updatedAt: z.number().int().nonnegative()
  })
  .strict();

const delayedSignalStoreSchema = z
  .object({
    version: z.literal(1),
    events: z.array(delayedSignalSchema)
  })
  .strict();

export type DelayedSignalsOptions = {
  config: ConfigModule;
  eventBus: EngineEventBus;
  signals: Pick<Signals, "generate">;
  failureRetryMs?: number;
  maxTimerMs?: number;
};

/**
 * Manages persistent delayed signal scheduling by wall-time (unix milliseconds).
 * Expects: `ensureDir()` is called before `start()` and scheduling operations.
 */
export class DelayedSignals {
  private readonly config: ConfigModule;
  private readonly eventBus: EngineEventBus;
  private readonly signals: Pick<Signals, "generate">;
  private readonly storePath: string;
  private readonly failureRetryMs: number;
  private readonly maxTimerMs: number;
  private readonly lock = new AsyncLock();
  private readonly events = new Map<string, DelayedSignal>();
  private loaded = false;
  private timer: NodeJS.Timeout | null = null;
  private started = false;
  private stopped = false;
  private running = false;

  constructor(options: DelayedSignalsOptions) {
    this.config = options.config;
    this.eventBus = options.eventBus;
    this.signals = options.signals;
    this.storePath = path.join(this.config.current.configDir, "signals", "delayed.json");
    this.failureRetryMs = Math.max(10, Math.floor(options.failureRetryMs ?? 1_000));
    this.maxTimerMs = Math.max(1_000, Math.floor(options.maxTimerMs ?? 60_000));
  }

  async ensureDir(): Promise<void> {
    const basePath = path.dirname(this.storePath);
    await fs.mkdir(basePath, { recursive: true });
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
    return delayedSignalsSort(Array.from(this.events.values()));
  }

  /**
   * Schedules a delayed signal delivery and replaces existing (type + repeatKey) entry.
   * Expects: `deliverAt` is a unix timestamp in milliseconds.
   */
  async schedule(input: DelayedSignalScheduleInput): Promise<DelayedSignal> {
    const normalized = delayedSignalScheduleNormalize(input);
    const now = Date.now();
    const created = await this.lock.inLock(async () => {
      await this.loadUnlocked();
      if (normalized.repeatKey) {
        for (const existing of this.events.values()) {
          if (existing.type === normalized.type && existing.repeatKey === normalized.repeatKey) {
            this.events.delete(existing.id);
          }
        }
      }

      const next: DelayedSignal = {
        id: createId(),
        type: normalized.type,
        deliverAt: normalized.deliverAt,
        source: normalized.source,
        data: normalized.data,
        repeatKey: normalized.repeatKey,
        createdAt: now,
        updatedAt: now
      };
      this.events.set(next.id, next);
      await this.persistUnlocked();
      return { ...next };
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
      let count = 0;
      for (const existing of this.events.values()) {
        if (existing.type === normalized.type && existing.repeatKey === normalized.repeatKey) {
          this.events.delete(existing.id);
          count += 1;
        }
      }
      if (count > 0) {
        await this.persistUnlocked();
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
    const delay = Math.min(
      this.maxTimerMs,
      Math.max(Math.floor(minimumDelayMs), untilDue)
    );
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
      logger.warn({ error }, "Delayed signal tick failed");
    } finally {
      this.running = false;
      this.scheduleNext(retry ? this.failureRetryMs : 0);
    }
  }

  private async deliverDue(): Promise<boolean> {
    const now = Date.now();
    const due = await this.lock.inLock(async () => {
      await this.loadUnlocked();
      return delayedSignalsSort(
        Array.from(this.events.values()).filter((entry) => entry.deliverAt <= now)
      );
    });
    if (due.length === 0) {
      return false;
    }

    let retryNeeded = false;
    for (const delayed of due) {
      const input: SignalGenerateInput = {
        type: delayed.type,
        source: delayed.source,
        data: delayed.data
      };
      try {
        await this.signals.generate(input);
      } catch (error) {
        retryNeeded = true;
        logger.warn(
          { delayedSignalId: delayed.id, type: delayed.type, error },
          "Delayed signal delivery failed"
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
        await this.persistUnlocked();
        removed = true;
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
    let raw: string;
    try {
      raw = await fs.readFile(this.storePath, "utf8");
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") {
        this.events.clear();
        return;
      }
      throw error;
    }

    const parsed = delayedSignalStoreSchema.parse(JSON.parse(raw));
    this.events.clear();
    for (const item of parsed.events) {
      this.events.set(item.id, item);
    }
  }

  private async persistUnlocked(): Promise<void> {
    const payload = {
      version: 1 as const,
      events: delayedSignalsSort(Array.from(this.events.values()))
    };
    await atomicWrite(this.storePath, `${JSON.stringify(payload, null, 2)}\n`);
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

function signalSourceNormalize(source?: SignalSource): SignalSource {
  if (!source) {
    return { type: "system" };
  }
  if (source.type === "system") {
    return { type: "system" };
  }
  if (source.type === "agent") {
    const id = source.id.trim();
    if (!id) {
      throw new Error("Agent signal source id is required");
    }
    return { type: "agent", id };
  }
  if (source.type === "webhook") {
    const id = source.id?.trim();
    return { type: "webhook", ...(id ? { id } : {}) };
  }
  if (source.type === "process") {
    const id = source.id?.trim();
    return { type: "process", ...(id ? { id } : {}) };
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
