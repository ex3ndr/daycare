import type { Context } from "@/types";
import { signalTypeMatchesPattern } from "../engine/signals/signalTypeMatchesPattern.js";
import { AsyncLock } from "../util/lock.js";
import type { StorageDatabase } from "./databaseOpen.js";
import type { DatabaseSignalSubscriptionRow, SignalSubscriptionDbRecord } from "./databaseTypes.js";

/**
 * Signal subscriptions repository backed by SQLite with write-through caching.
 * Expects: schema migrations already applied for signals_subscriptions.
 */
export class SignalSubscriptionsRepository {
    private readonly db: StorageDatabase;
    private readonly subscriptionsByKey = new Map<string, SignalSubscriptionDbRecord>();
    private readonly subscriptionLocks = new Map<string, AsyncLock>();
    private readonly cacheLock = new AsyncLock();
    private readonly createLock = new AsyncLock();
    private allSubscriptionsLoaded = false;

    constructor(db: StorageDatabase) {
        this.db = db;
    }

    async create(record: SignalSubscriptionDbRecord): Promise<void> {
        await this.createLock.inLock(async () => {
            await this.db
                .prepare(
                    `
                  INSERT INTO signals_subscriptions (
                    id,
                    user_id,
                    agent_id,
                    pattern,
                    silent,
                    created_at,
                    updated_at
                  ) VALUES (?, ?, ?, ?, ?, ?, ?)
                  ON CONFLICT(user_id, agent_id, pattern) DO UPDATE SET
                    id = excluded.id,
                    silent = excluded.silent,
                    updated_at = excluded.updated_at
                `
                )
                .run(
                    record.id,
                    record.userId,
                    record.agentId,
                    record.pattern,
                    record.silent ? 1 : 0,
                    record.createdAt,
                    record.updatedAt
                );

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
            const removed = await this.db
                .prepare("DELETE FROM signals_subscriptions WHERE user_id = ? AND agent_id = ? AND pattern = ?")
                .run(keys.userId, keys.agentId, pattern);
            const rawChanges = (removed as { changes?: number | bigint }).changes;
            const changes = typeof rawChanges === "bigint" ? Number(rawChanges) : (rawChanges ?? 0);

            await this.cacheLock.inLock(() => {
                this.subscriptionsByKey.delete(key);
            });
            return changes > 0;
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
            .prepare(
                "SELECT * FROM signals_subscriptions ORDER BY user_id ASC, agent_id ASC, pattern ASC, created_at ASC, id ASC"
            )
            .all() as DatabaseSignalSubscriptionRow[];
        const parsed = signalSubscriptionsSort(rows.map((row) => this.subscriptionParse(row)));

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
        const row = await this.db
            .prepare("SELECT * FROM signals_subscriptions WHERE user_id = ? AND agent_id = ? AND pattern = ? LIMIT 1")
            .get(keys.userId, keys.agentId, pattern) as DatabaseSignalSubscriptionRow | undefined;
        if (!row) {
            return null;
        }
        return this.subscriptionParse(row);
    }

    private subscriptionParse(row: DatabaseSignalSubscriptionRow): SignalSubscriptionDbRecord {
        return {
            id: row.id,
            userId: row.user_id,
            agentId: row.agent_id,
            pattern: row.pattern,
            silent: row.silent === 1,
            createdAt: row.created_at,
            updatedAt: row.updated_at
        };
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
