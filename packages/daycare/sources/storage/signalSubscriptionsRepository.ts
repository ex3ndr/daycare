import { and, asc, eq } from "drizzle-orm";
import type { Context } from "@/types";
import { signalTypeMatchesPattern } from "../engine/signals/signalTypeMatchesPattern.js";
import type { DaycareDb } from "../schema.js";
import { signalsSubscriptionsTable } from "../schema.js";
import { AsyncLock } from "../util/lock.js";
import type { SignalSubscriptionDbRecord } from "./databaseTypes.js";

/**
 * Signal subscriptions repository backed by Drizzle with write-through caching.
 * Expects: schema migrations already applied for signals_subscriptions.
 */
export class SignalSubscriptionsRepository {
    private readonly db: DaycareDb;
    private readonly subscriptionsByKey = new Map<string, SignalSubscriptionDbRecord>();
    private readonly subscriptionLocks = new Map<string, AsyncLock>();
    private readonly cacheLock = new AsyncLock();
    private readonly createLock = new AsyncLock();
    private allSubscriptionsLoaded = false;

    constructor(db: DaycareDb) {
        this.db = db;
    }

    async create(record: SignalSubscriptionDbRecord): Promise<void> {
        await this.createLock.inLock(async () => {
            await this.db
                .insert(signalsSubscriptionsTable)
                .values({
                    id: record.id,
                    userId: record.userId,
                    agentId: record.agentId,
                    pattern: record.pattern,
                    silent: record.silent ? 1 : 0,
                    createdAt: record.createdAt,
                    updatedAt: record.updatedAt
                })
                .onConflictDoUpdate({
                    target: [
                        signalsSubscriptionsTable.userId,
                        signalsSubscriptionsTable.agentId,
                        signalsSubscriptionsTable.pattern
                    ],
                    set: {
                        id: record.id,
                        silent: record.silent ? 1 : 0,
                        updatedAt: record.updatedAt
                    }
                });

            await this.cacheLock.inLock(() => {
                this.subscriptionCacheSet(record);
            });
        });
    }

    async delete(ctx: Context, pattern: string): Promise<boolean> {
        const keys = contextKeysNormalize(ctx);
        if (!keys) {
            return false;
        }
        const key = subscriptionKeyBuild(keys, pattern);
        const lock = await this.subscriptionLockForKey(key);
        return lock.inLock(async () => {
            const result = await this.db
                .delete(signalsSubscriptionsTable)
                .where(
                    and(
                        eq(signalsSubscriptionsTable.userId, keys.userId),
                        eq(signalsSubscriptionsTable.agentId, keys.agentId),
                        eq(signalsSubscriptionsTable.pattern, pattern)
                    )
                )
                .returning({ id: signalsSubscriptionsTable.id });

            await this.cacheLock.inLock(() => {
                this.subscriptionsByKey.delete(key);
            });
            return result.length > 0;
        });
    }

    async findByUserAndAgent(ctx: Context, pattern: string): Promise<SignalSubscriptionDbRecord | null> {
        const keys = contextKeysNormalize(ctx);
        if (!keys) {
            return null;
        }
        const key = subscriptionKeyBuild(keys, pattern);
        const lock = await this.subscriptionLockForKey(key);
        return lock.inLock(async () => {
            const existing = await this.cacheLock.inLock(() => {
                const cached = this.subscriptionsByKey.get(key);
                if (cached) {
                    return signalSubscriptionClone(cached);
                }
                if (this.allSubscriptionsLoaded) {
                    return null;
                }
                return undefined;
            });
            if (existing !== undefined) {
                return existing;
            }

            const loaded = await this.subscriptionLoadByKey(ctx, pattern);
            if (!loaded) {
                return null;
            }
            await this.cacheLock.inLock(() => {
                this.subscriptionCacheSet(loaded);
            });
            return signalSubscriptionClone(loaded);
        });
    }

    async findMany(): Promise<SignalSubscriptionDbRecord[]> {
        const cached = await this.cacheLock.inLock(() => {
            if (!this.allSubscriptionsLoaded) {
                return null;
            }
            return signalSubscriptionsSort(Array.from(this.subscriptionsByKey.values())).map((entry) =>
                signalSubscriptionClone(entry)
            );
        });
        if (cached) {
            return cached;
        }

        const rows = await this.db
            .select()
            .from(signalsSubscriptionsTable)
            .orderBy(
                asc(signalsSubscriptionsTable.userId),
                asc(signalsSubscriptionsTable.agentId),
                asc(signalsSubscriptionsTable.pattern),
                asc(signalsSubscriptionsTable.createdAt),
                asc(signalsSubscriptionsTable.id)
            );
        const parsed = signalSubscriptionsSort(rows.map((row) => subscriptionParse(row)));

        await this.cacheLock.inLock(() => {
            this.subscriptionsByKey.clear();
            for (const record of parsed) {
                this.subscriptionCacheSet(record);
            }
            this.allSubscriptionsLoaded = true;
        });

        return parsed.map((entry) => signalSubscriptionClone(entry));
    }

    async findMatching(ctx: Context, signalType: string): Promise<SignalSubscriptionDbRecord[]> {
        const userId = ctx.userId.trim();
        if (!userId) {
            return [];
        }
        const all = await this.findMany();
        return all
            .filter((entry) => {
                if (entry.userId !== userId) {
                    return false;
                }
                return signalTypeMatchesPattern(signalType, entry.pattern);
            })
            .map((entry) => signalSubscriptionClone(entry));
    }

    private subscriptionCacheSet(record: SignalSubscriptionDbRecord): void {
        this.subscriptionsByKey.set(
            subscriptionKeyBuild({ userId: record.userId, agentId: record.agentId }, record.pattern),
            {
                ...record
            }
        );
    }

    private async subscriptionLoadByKey(ctx: Context, pattern: string): Promise<SignalSubscriptionDbRecord | null> {
        const keys = contextKeysNormalize(ctx);
        if (!keys) {
            return null;
        }
        const rows = await this.db
            .select()
            .from(signalsSubscriptionsTable)
            .where(
                and(
                    eq(signalsSubscriptionsTable.userId, keys.userId),
                    eq(signalsSubscriptionsTable.agentId, keys.agentId),
                    eq(signalsSubscriptionsTable.pattern, pattern)
                )
            )
            .limit(1);
        const row = rows[0];
        if (!row) {
            return null;
        }
        return subscriptionParse(row);
    }

    private async subscriptionLockForKey(key: string): Promise<AsyncLock> {
        const existing = this.subscriptionLocks.get(key);
        if (existing) {
            return existing;
        }
        return this.cacheLock.inLock(() => {
            const rechecked = this.subscriptionLocks.get(key);
            if (rechecked) {
                return rechecked;
            }
            const lock = new AsyncLock();
            this.subscriptionLocks.set(key, lock);
            return lock;
        });
    }
}

/** Converts a Drizzle row (camelCase) to the application record type. */
function subscriptionParse(row: {
    id: string;
    userId: string;
    agentId: string;
    pattern: string;
    silent: number;
    createdAt: number;
    updatedAt: number;
}): SignalSubscriptionDbRecord {
    return {
        id: row.id,
        userId: row.userId,
        agentId: row.agentId,
        pattern: row.pattern,
        silent: row.silent === 1,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt
    };
}

function subscriptionKeyBuild(ctx: Context, pattern: string): string {
    return `${ctx.userId}::${ctx.agentId}::${pattern}`;
}

function contextKeysNormalize(ctx: Context): { userId: string; agentId: string } | null {
    const userId = ctx.userId.trim();
    const agentId = ctx.agentId.trim();
    if (!userId || !agentId) {
        return null;
    }
    return { userId, agentId };
}

function signalSubscriptionClone(record: SignalSubscriptionDbRecord): SignalSubscriptionDbRecord {
    return {
        ...record
    };
}

function signalSubscriptionsSort(records: SignalSubscriptionDbRecord[]): SignalSubscriptionDbRecord[] {
    return records.slice().sort((left, right) => {
        if (left.userId !== right.userId) {
            return left.userId.localeCompare(right.userId);
        }
        if (left.agentId !== right.agentId) {
            return left.agentId.localeCompare(right.agentId);
        }
        if (left.pattern !== right.pattern) {
            return left.pattern.localeCompare(right.pattern);
        }
        if (left.createdAt !== right.createdAt) {
            return left.createdAt - right.createdAt;
        }
        return left.id.localeCompare(right.id);
    });
}
