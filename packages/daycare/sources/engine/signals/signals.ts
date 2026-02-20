import { promises as fs } from "node:fs";
import path from "node:path";

import { createId } from "@paralleldrive/cuid2";

import { getLogger } from "../../log.js";
import { AsyncLock } from "../../util/lock.js";
import type { EngineEventBus } from "../ipc/events.js";
import { signalTypeMatchesPattern } from "./signalTypeMatchesPattern.js";
import type {
    Signal,
    SignalGenerateInput,
    SignalSource,
    SignalSubscribeInput,
    SignalSubscription,
    SignalUnsubscribeInput
} from "./signalTypes.js";

const logger = getLogger("signal.facade");

export type SignalsOptions = {
    eventBus: EngineEventBus;
    configDir: string;
    onDeliver?: (signal: Signal, subscriptions: SignalSubscription[]) => Promise<void> | void;
};

export class Signals {
    private readonly eventBus: EngineEventBus;
    private readonly signalsDir: string;
    private readonly eventsPath: string;
    private readonly appendLock = new AsyncLock();
    private readonly onDeliver: SignalsOptions["onDeliver"];
    private readonly subscriptions = new Map<string, SignalSubscription>();

    constructor(options: SignalsOptions) {
        this.eventBus = options.eventBus;
        this.signalsDir = path.join(options.configDir, "signals");
        this.eventsPath = path.join(this.signalsDir, "events.jsonl");
        this.onDeliver = options.onDeliver;
    }

    async ensureDir(): Promise<void> {
        await fs.mkdir(this.signalsDir, { recursive: true });
    }

    /**
     * Generates a signal event and publishes it to the engine event bus.
     * Expects: input.type is non-empty after trim.
     */
    async generate(input: SignalGenerateInput): Promise<Signal> {
        const type = input.type.trim();
        if (!type) {
            throw new Error("Signal type is required");
        }

        const source = signalSourceNormalize(input.source);

        const signal: Signal = {
            id: createId(),
            type,
            source,
            data: input.data,
            createdAt: Date.now()
        };

        await this.signalAppend(signal);
        this.eventBus.emit("signal.generated", signal);
        const subscriptions = this.signalSubscriptionsMatch(signal);
        if (subscriptions.length > 0) {
            await this.signalDeliver(signal, subscriptions);
        }
        logger.info(
            {
                signalId: signal.id,
                type: signal.type,
                sourceType: signal.source.type,
                sourceId: "id" in signal.source ? (signal.source.id ?? null) : null
            },
            "event: Signal generated"
        );

        return signal;
    }

    subscribe(input: SignalSubscribeInput): SignalSubscription {
        const { userId, pattern, agentId } = signalSubscriptionInputNormalize(input);
        const key = signalSubscriptionKeyBuild(userId, agentId, pattern);
        const now = Date.now();
        const existing = this.subscriptions.get(key);
        const subscription: SignalSubscription = existing
            ? {
                  ...existing,
                  silent: input.silent ?? existing.silent,
                  updatedAt: now
              }
            : {
                  userId,
                  agentId,
                  pattern,
                  silent: input.silent ?? true,
                  createdAt: now,
                  updatedAt: now
              };
        this.subscriptions.set(key, subscription);
        return subscription;
    }

    /**
     * Returns a subscription for an exact agent + pattern pair when present.
     * Returns: null when no subscription exists.
     */
    subscriptionGet(input: SignalUnsubscribeInput): SignalSubscription | null {
        const { userId, pattern, agentId } = signalSubscriptionInputNormalize(input);
        const key = signalSubscriptionKeyBuild(userId, agentId, pattern);
        const subscription = this.subscriptions.get(key);
        return subscription ? { ...subscription } : null;
    }

    /**
     * Removes an existing signal subscription for agent + pattern.
     * Returns: true when a subscription existed and was removed.
     */
    unsubscribe(input: SignalUnsubscribeInput): boolean {
        const { userId, pattern, agentId } = signalSubscriptionInputNormalize(input);
        const key = signalSubscriptionKeyBuild(userId, agentId, pattern);
        return this.subscriptions.delete(key);
    }

    /**
     * Returns all active signal subscriptions as a snapshot array.
     */
    listSubscriptions(): SignalSubscription[] {
        return Array.from(this.subscriptions.values());
    }

    /**
     * Returns all persisted signal events in append order.
     */
    async listAll(): Promise<Signal[]> {
        return this.appendLock.inLock(async () => {
            try {
                const raw = await fs.readFile(this.eventsPath, "utf8");
                return signalLinesParse(raw);
            } catch (error) {
                if ((error as NodeJS.ErrnoException).code === "ENOENT") {
                    return [];
                }
                throw error;
            }
        });
    }

    async listRecent(limit = 200): Promise<Signal[]> {
        const normalizedLimit = signalLimitNormalize(limit);
        return this.appendLock.inLock(async () => {
            try {
                const raw = await fs.readFile(this.eventsPath, "utf8");
                const events = signalLinesParse(raw);
                if (events.length <= normalizedLimit) {
                    return events;
                }
                return events.slice(events.length - normalizedLimit);
            } catch (error) {
                if ((error as NodeJS.ErrnoException).code === "ENOENT") {
                    return [];
                }
                throw error;
            }
        });
    }

    private async signalAppend(signal: Signal): Promise<void> {
        const line = `${JSON.stringify(signal)}\n`;
        await this.appendLock.inLock(async () => {
            await fs.mkdir(this.signalsDir, { recursive: true });
            await fs.appendFile(this.eventsPath, line, "utf8");
        });
    }

    private signalSubscriptionsMatch(signal: Signal): SignalSubscription[] {
        const matches: SignalSubscription[] = [];
        const sourceUserId =
            typeof signal.source.userId === "string" && signal.source.userId.trim().length > 0
                ? signal.source.userId.trim()
                : null;
        for (const subscription of this.subscriptions.values()) {
            if (sourceUserId && subscription.userId !== sourceUserId) {
                continue;
            }
            if (signalTypeMatchesPattern(signal.type, subscription.pattern)) {
                matches.push(subscription);
            }
        }
        return matches;
    }

    private async signalDeliver(signal: Signal, subscriptions: SignalSubscription[]): Promise<void> {
        if (!this.onDeliver) {
            return;
        }
        try {
            await this.onDeliver(signal, subscriptions);
        } catch (error) {
            logger.warn({ signalId: signal.id, error }, "error: Signal delivery failed");
        }
    }
}

function signalSourceNormalize(source?: SignalSource): SignalSource {
    if (!source) {
        return { type: "system" };
    }
    if (source.type === "system") {
        const userId = signalSourceUserIdNormalize(source.userId);
        return userId ? { type: "system", userId } : { type: "system" };
    }
    if (source.type === "agent") {
        const id = source.id.trim();
        if (!id) {
            throw new Error("Agent signal source id is required");
        }
        const userId = signalSourceUserIdNormalize(source.userId);
        return userId ? { type: "agent", id, userId } : { type: "agent", id };
    }
    if (source.type === "webhook") {
        const userId = signalSourceUserIdNormalize(source.userId);
        return {
            type: "webhook",
            ...(userId ? { userId } : {}),
            id: typeof source.id === "string" && source.id.trim().length > 0 ? source.id.trim() : undefined
        };
    }
    if (source.type === "process") {
        const userId = signalSourceUserIdNormalize(source.userId);
        return {
            type: "process",
            ...(userId ? { userId } : {}),
            id: typeof source.id === "string" && source.id.trim().length > 0 ? source.id.trim() : undefined
        };
    }
    throw new Error(`Unsupported signal source type: ${(source as { type?: unknown }).type}`);
}

function signalLimitNormalize(limit: number): number {
    if (!Number.isFinite(limit)) {
        return 200;
    }
    return Math.min(1000, Math.max(1, Math.floor(limit)));
}

function signalLinesParse(content: string): Signal[] {
    const lines = content.split("\n").filter((line) => line.trim().length > 0);
    const events: Signal[] = [];
    for (const line of lines) {
        try {
            const parsed = JSON.parse(line) as Signal;
            events.push(parsed);
        } catch {
            // Ignore malformed lines to keep dashboard reads resilient.
        }
    }
    return events;
}

function signalSubscriptionKeyBuild(userId: string, agentId: string, pattern: string): string {
    return `${userId}::${agentId}::${pattern}`;
}

function signalSubscriptionInputNormalize(input: { userId: string; agentId: string; pattern: string }): {
    userId: string;
    agentId: string;
    pattern: string;
} {
    const userId = input.userId.trim();
    if (!userId) {
        throw new Error("Signal subscription userId is required");
    }
    const pattern = input.pattern.trim();
    if (!pattern) {
        throw new Error("Signal subscription pattern is required");
    }
    const agentId = input.agentId.trim();
    if (!agentId) {
        throw new Error("Signal subscription agentId is required");
    }
    return { userId, pattern, agentId };
}

function signalSourceUserIdNormalize(userId?: string): string | undefined {
    if (typeof userId !== "string") {
        return undefined;
    }
    const normalized = userId.trim();
    return normalized.length > 0 ? normalized : undefined;
}
