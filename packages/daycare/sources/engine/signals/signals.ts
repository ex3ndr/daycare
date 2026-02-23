import path from "node:path";
import { createId } from "@paralleldrive/cuid2";
import type { Context } from "@/types";

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
    signalEvents: Pick<SignalEventsRepository, "create" | "findAll" | "findRecentAll">;
    signalSubscriptions: Pick<
        SignalSubscriptionsRepository,
        "create" | "delete" | "findByUserAndAgent" | "findMany" | "findMatching"
    >;
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
    private readonly signalEvents: Pick<SignalEventsRepository, "create" | "findAll" | "findRecentAll">;
    private readonly signalSubscriptions: Pick<
        SignalSubscriptionsRepository,
        "create" | "delete" | "findByUserAndAgent" | "findMany" | "findMatching"
    >;
    private readonly onDeliver: SignalsOptions["onDeliver"];

    constructor(options: SignalsOptions) {
        this.eventBus = options.eventBus;
        if ("signalEvents" in options) {
            this.signalEvents = options.signalEvents;
            this.signalSubscriptions = options.signalSubscriptions;
        } else {
            const storage = Storage.open(path.join(options.configDir, "daycare.db"));
            this.signalEvents = storage.signalEvents;
            this.signalSubscriptions = storage.signalSubscriptions;
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

        const signal: Signal = {
            id: createId(),
            type,
            source,
            data: input.data,
            createdAt: Date.now()
        };

        await this.signalEvents.create(signalRecordBuild(signal, source.userId));
        this.eventBus.emit("signal.generated", signal);
        const subscriptions = (
            await this.signalSubscriptions.findMatching(contextFromUserId(signal.source.userId), signal.type)
        ).map((record) => signalSubscriptionBuild(record));
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
        const { ctx, pattern } = signalSubscriptionInputNormalize(input);
        const now = Date.now();
        const existing = await this.signalSubscriptions.findByUserAndAgent(ctx, pattern);
        const subscription: SignalSubscription = existing
            ? {
                  ...signalSubscriptionBuild(existing),
                  silent: input.silent ?? existing.silent,
                  updatedAt: now
              }
            : {
                  ctx: {
                      userId: ctx.userId,
                      agentId: ctx.agentId
                  },
                  pattern,
                  silent: input.silent ?? true,
                  createdAt: now,
                  updatedAt: now
              };
        await this.signalSubscriptions.create({
            id: existing?.id ?? createId(),
            userId: subscription.ctx.userId,
            agentId: subscription.ctx.agentId,
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
        const { ctx, pattern } = signalSubscriptionInputNormalize(input);
        const subscription = await this.signalSubscriptions.findByUserAndAgent(ctx, pattern);
        return subscription ? signalSubscriptionBuild(subscription) : null;
    }

    /**
     * Removes an existing signal subscription for agent + pattern.
     * Returns: true when a subscription existed and was removed.
     */
    async unsubscribe(input: SignalUnsubscribeInput): Promise<boolean> {
        const { ctx, pattern } = signalSubscriptionInputNormalize(input);
        return this.signalSubscriptions.delete(ctx, pattern);
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
        const events = await this.signalEvents.findAll();
        return events.map((event) => signalBuild(event));
    }

    async listRecent(limit = 200): Promise<Signal[]> {
        const events = await this.signalEvents.findRecentAll(signalLimitNormalize(limit));
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
        const userId = signalSourceUserIdNormalize(source.userId);
        return {
            type: "webhook",
            userId,
            id: typeof source.id === "string" && source.id.trim().length > 0 ? source.id.trim() : undefined
        };
    }
    if (source.type === "process") {
        const userId = signalSourceUserIdNormalize(source.userId);
        return {
            type: "process",
            userId,
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
        ctx: {
            userId: record.userId,
            agentId: record.agentId
        },
        pattern: record.pattern,
        silent: record.silent,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt
    };
}

function signalSubscriptionInputNormalize(input: { ctx: Context; pattern: string }): {
    ctx: Context;
    pattern: string;
} {
    const userId = input.ctx.userId.trim();
    if (!userId) {
        throw new Error("Signal subscription userId is required");
    }
    const pattern = input.pattern.trim();
    if (!pattern) {
        throw new Error("Signal subscription pattern is required");
    }
    let inputAgentId: string;
    try {
        inputAgentId = input.ctx.agentId;
    } catch {
        throw new Error("Signal subscription agentId is required");
    }
    const agentId = inputAgentId.trim();
    if (!agentId) {
        throw new Error("Signal subscription agentId is required");
    }
    return { ctx: { userId, agentId }, pattern };
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

function contextFromUserId(userId: string): Context {
    return { agentId: "signal", userId: signalSourceUserIdNormalize(userId) };
}
