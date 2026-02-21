import path from "node:path";
import { createId } from "@paralleldrive/cuid2";

import { getLogger } from "../../log.js";
import type { SignalEventDbRecord, SignalSubscriptionDbRecord } from "../../storage/databaseTypes.js";
import type { SignalEventsRepository } from "../../storage/signalEventsRepository.js";
import type { SignalSubscriptionsRepository } from "../../storage/signalSubscriptionsRepository.js";
import { Storage } from "../../storage/storage.js";
import type { EngineEventBus } from "../ipc/events.js";
import type {
    Signal,
    SignalGenerateInput,
    SignalSource,
    SignalSubscribeInput,
    SignalSubscription,
    SignalUnsubscribeInput
} from "./signalTypes.js";

const logger = getLogger("signal.facade");

type SignalsRepositoryOptions = {
    signalEvents: Pick<SignalEventsRepository, "create" | "findMany" | "findRecent">;
    signalSubscriptions: Pick<
        SignalSubscriptionsRepository,
        "create" | "delete" | "findByUserAndAgent" | "findMany" | "findMatching"
    >;
    fallbackUserIdResolve: () => Promise<string>;
};

type SignalsLegacyOptions = {
    configDir: string;
};

export type SignalsOptions = {
    eventBus: EngineEventBus;
    onDeliver?: (signal: Signal, subscriptions: SignalSubscription[]) => Promise<void> | void;
} & (SignalsRepositoryOptions | SignalsLegacyOptions);

export class Signals {
    private readonly eventBus: EngineEventBus;
    private readonly signalEvents: Pick<SignalEventsRepository, "create" | "findMany" | "findRecent">;
    private readonly signalSubscriptions: Pick<
        SignalSubscriptionsRepository,
        "create" | "delete" | "findByUserAndAgent" | "findMany" | "findMatching"
    >;
    private readonly fallbackUserIdResolve: () => Promise<string>;
    private readonly onDeliver: SignalsOptions["onDeliver"];

    constructor(options: SignalsOptions) {
        this.eventBus = options.eventBus;
        if ("signalEvents" in options) {
            this.signalEvents = options.signalEvents;
            this.signalSubscriptions = options.signalSubscriptions;
            this.fallbackUserIdResolve = options.fallbackUserIdResolve;
        } else {
            const storage = Storage.open(path.join(options.configDir, "daycare.db"));
            this.signalEvents = storage.signalEvents;
            this.signalSubscriptions = storage.signalSubscriptions;
            this.fallbackUserIdResolve = async () => {
                const owner = await storage.users.findOwner();
                return owner?.id ?? "owner";
            };
        }
        this.onDeliver = options.onDeliver;
    }

    async ensureDir(): Promise<void> {
        return Promise.resolve();
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
        const userId = source.userId ?? (await this.fallbackUserIdResolve());

        const signal: Signal = {
            id: createId(),
            type,
            source,
            data: input.data,
            createdAt: Date.now()
        };

        await this.signalEvents.create(signalRecordBuild(signal, userId));
        this.eventBus.emit("signal.generated", signal);
        const subscriptions = (await this.signalSubscriptions.findMatching(signal.type, signal.source.userId)).map(
            (record) => signalSubscriptionBuild(record)
        );
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

    async subscribe(input: SignalSubscribeInput): Promise<SignalSubscription> {
        const { userId, pattern, agentId } = signalSubscriptionInputNormalize(input);
        const now = Date.now();
        const existing = await this.signalSubscriptions.findByUserAndAgent(userId, agentId, pattern);
        const subscription: SignalSubscription = existing
            ? {
                  ...signalSubscriptionBuild(existing),
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
        await this.signalSubscriptions.create({
            id: existing?.id ?? createId(),
            userId: subscription.userId,
            agentId: subscription.agentId,
            pattern: subscription.pattern,
            silent: subscription.silent,
            createdAt: subscription.createdAt,
            updatedAt: subscription.updatedAt
        });
        return { ...subscription };
    }

    /**
     * Returns a subscription for an exact agent + pattern pair when present.
     * Returns: null when no subscription exists.
     */
    async subscriptionGet(input: SignalUnsubscribeInput): Promise<SignalSubscription | null> {
        const { userId, pattern, agentId } = signalSubscriptionInputNormalize(input);
        const subscription = await this.signalSubscriptions.findByUserAndAgent(userId, agentId, pattern);
        return subscription ? signalSubscriptionBuild(subscription) : null;
    }

    /**
     * Removes an existing signal subscription for agent + pattern.
     * Returns: true when a subscription existed and was removed.
     */
    async unsubscribe(input: SignalUnsubscribeInput): Promise<boolean> {
        const { userId, pattern, agentId } = signalSubscriptionInputNormalize(input);
        return this.signalSubscriptions.delete(userId, agentId, pattern);
    }

    /**
     * Returns all active signal subscriptions as a snapshot array.
     */
    async listSubscriptions(): Promise<SignalSubscription[]> {
        const subscriptions = await this.signalSubscriptions.findMany();
        return subscriptions.map((subscription) => signalSubscriptionBuild(subscription));
    }

    /**
     * Returns all persisted signal events in append order.
     */
    async listAll(): Promise<Signal[]> {
        const events = await this.signalEvents.findMany();
        return events.map((event) => signalBuild(event));
    }

    async listRecent(limit = 200): Promise<Signal[]> {
        const events = await this.signalEvents.findRecent(signalLimitNormalize(limit));
        return events.map((event) => signalBuild(event));
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

function signalBuild(record: SignalEventDbRecord): Signal {
    return {
        id: record.id,
        type: record.type,
        source: record.source,
        ...(record.data === undefined ? {} : { data: record.data }),
        createdAt: record.createdAt
    };
}

function signalRecordBuild(signal: Signal, userId: string): SignalEventDbRecord {
    return {
        id: signal.id,
        userId,
        type: signal.type,
        source: signal.source,
        data: signal.data,
        createdAt: signal.createdAt
    };
}

function signalSubscriptionBuild(record: SignalSubscriptionDbRecord): SignalSubscription {
    return {
        userId: record.userId,
        agentId: record.agentId,
        pattern: record.pattern,
        silent: record.silent,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt
    };
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
