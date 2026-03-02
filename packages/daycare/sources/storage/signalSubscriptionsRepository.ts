import { and, asc, eq, isNull } from "drizzle-orm";
import type { Context } from "@/types";
import { signalTypeMatchesPattern } from "../engine/signals/signalTypeMatchesPattern.js";
import type { DaycareDb } from "../schema.js";
import { signalsSubscriptionsTable } from "../schema.js";
import { AsyncLock } from "../utils/lock.js";
import type { SignalSubscriptionDbRecord } from "./databaseTypes.js";
import { versionAdvance } from "./versionAdvance.js";

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
            const currentRows = await this.db
                .select()
                .from(signalsSubscriptionsTable)
                .where(
                    and(
                        eq(signalsSubscriptionsTable.userId, record.userId),
                        eq(signalsSubscriptionsTable.agentId, record.agentId),
                        eq(signalsSubscriptionsTable.pattern, record.pattern),
                        isNull(signalsSubscriptionsTable.validTo)
                    )
                )
                .limit(1);
            const current = currentRows[0] ? subscriptionParse(currentRows[0]) : null;
            const next = current
                ? await this.db.transaction(async (tx) =>
                      versionAdvance<SignalSubscriptionDbRecord>({
                          changes: {
                              silent: record.silent,
                              updatedAt: record.updatedAt
                          },
                          findCurrent: async () => current,
                          closeCurrent: async (row, now) => {
                              const closedRows = await tx
                                  .update(signalsSubscriptionsTable)
                                  .set({ validTo: now })
                                  .where(
                                      and(
                                          eq(signalsSubscriptionsTable.id, row.id),
                                          eq(signalsSubscriptionsTable.version, row.version ?? 1),
                                          isNull(signalsSubscriptionsTable.validTo)
                                      )
                                  )
                                  .returning({ version: signalsSubscriptionsTable.version });
                              return closedRows.length;
                          },
                          insertNext: async (row) => {
                              await tx.insert(signalsSubscriptionsTable).values({
                                  id: row.id,
                                  version: row.version ?? 1,
                                  validFrom: row.validFrom ?? row.createdAt,
                                  validTo: row.validTo ?? null,
                                  userId: row.userId,
                                  agentId: row.agentId,
                                  pattern: row.pattern,
                                  silent: row.silent,
                                  createdAt: row.createdAt,
                                  updatedAt: row.updatedAt
                              });
                          }
                      })
                  )
                : {
                      ...record,
                      version: 1,
                      validFrom: record.createdAt,
                      validTo: null
                  };

            if (!current) {
                await this.db.insert(signalsSubscriptionsTable).values({
                    id: next.id,
                    version: next.version ?? 1,
                    validFrom: next.validFrom ?? next.createdAt,
                    validTo: next.validTo ?? null,
                    userId: next.userId,
                    agentId: next.agentId,
                    pattern: next.pattern,
                    silent: next.silent,
                    createdAt: next.createdAt,
                    updatedAt: next.updatedAt
                });
            }

            await this.cacheLock.inLock(() => {
                this.subscriptionCacheSet(next);
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
            const rows = await this.db
                .select()
                .from(signalsSubscriptionsTable)
                .where(
                    and(
                        eq(signalsSubscriptionsTable.userId, keys.userId),
                        eq(signalsSubscriptionsTable.agentId, keys.agentId),
                        eq(signalsSubscriptionsTable.pattern, pattern),
                        isNull(signalsSubscriptionsTable.validTo)
                    )
                )
                .limit(1);
            const current = rows[0] ? subscriptionParse(rows[0]) : null;
            if (!current) {
                return false;
            }
            await this.db
                .update(signalsSubscriptionsTable)
                .set({ validTo: Date.now() })
                .where(
                    and(
                        eq(signalsSubscriptionsTable.id, current.id),
                        eq(signalsSubscriptionsTable.version, current.version ?? 1),
                        isNull(signalsSubscriptionsTable.validTo)
                    )
                );

            await this.cacheLock.inLock(() => {
                this.subscriptionsByKey.delete(key);
            });
            return true;
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
            .where(isNull(signalsSubscriptionsTable.validTo))
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
                    eq(signalsSubscriptionsTable.pattern, pattern),
                    isNull(signalsSubscriptionsTable.validTo)
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
    version: number;
    validFrom: number;
    validTo: number | null;
    userId: string;
    agentId: string;
    pattern: string;
    silent: boolean;
    createdAt: number;
    updatedAt: number;
}): SignalSubscriptionDbRecord {
    return {
        id: row.id,
        version: row.version ?? 1,
        validFrom: row.validFrom ?? row.createdAt,
        validTo: row.validTo ?? null,
        userId: row.userId,
        agentId: row.agentId,
        pattern: row.pattern,
        silent: row.silent,
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
