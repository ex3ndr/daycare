import { and, asc, desc, eq, isNull } from "drizzle-orm";
import type { Context } from "@/types";
import type { DaycareDb } from "../schema.js";
import { keyValuesTable } from "../schema.js";
import { AsyncLock } from "../utils/lock.js";
import type { KeyValueDbRecord } from "./databaseTypes.js";
import { versionAdvance } from "./versionAdvance.js";

export type KeyValueCreateInput = {
    key: string;
    value: unknown;
    createdAt?: number;
    updatedAt?: number;
};

/**
 * Stores arbitrary JSON-compatible values per user and key.
 * Expects: ctx.userId and key are non-empty; value is provided (can be null).
 */
export class KeyValuesRepository {
    private readonly db: DaycareDb;
    private readonly keyLocks = new Map<string, AsyncLock>();

    constructor(db: DaycareDb) {
        this.db = db;
    }

    async findMany(ctx: Context): Promise<KeyValueDbRecord[]> {
        const rows = await this.db
            .select()
            .from(keyValuesTable)
            .where(and(eq(keyValuesTable.userId, ctx.userId), isNull(keyValuesTable.validTo)))
            .orderBy(asc(keyValuesTable.key));
        return rows.map((row) => keyValueParse(row));
    }

    async findByKey(ctx: Context, key: string): Promise<KeyValueDbRecord | null> {
        const normalizedKey = keyNormalize(key);
        if (!normalizedKey) {
            return null;
        }
        const rows = await this.db
            .select()
            .from(keyValuesTable)
            .where(
                and(
                    eq(keyValuesTable.userId, ctx.userId),
                    eq(keyValuesTable.key, normalizedKey),
                    isNull(keyValuesTable.validTo)
                )
            )
            .limit(1);
        const row = rows[0];
        if (!row) {
            return null;
        }
        return keyValueParse(row);
    }

    async create(ctx: Context, input: KeyValueCreateInput): Promise<KeyValueDbRecord> {
        const key = keyNormalize(input.key);
        if (!key) {
            throw new Error("key is required.");
        }
        if (input.value === undefined) {
            throw new Error("value is required.");
        }

        const lock = this.keyLockFor(ctx.userId, key);
        return lock.inLock(async () => {
            const existing = await this.findByKey(ctx, key);
            if (existing) {
                throw new Error(`Key already exists: ${key}`);
            }

            const latest = await this.keyLoadLatestByKey(ctx.userId, key);
            const createdAt = timestampResolve(input.createdAt) ?? Date.now();
            const updatedAt = timestampResolve(input.updatedAt) ?? createdAt;
            const version = latest ? (latest.version ?? 1) + 1 : 1;

            const next: KeyValueDbRecord = {
                userId: ctx.userId,
                key,
                version,
                validFrom: createdAt,
                validTo: null,
                value: structuredClone(input.value),
                createdAt,
                updatedAt
            };

            await this.db.insert(keyValuesTable).values({
                userId: next.userId,
                key: next.key,
                version: next.version ?? 1,
                validFrom: next.validFrom ?? next.createdAt,
                validTo: next.validTo ?? null,
                value: next.value,
                createdAt: next.createdAt,
                updatedAt: next.updatedAt
            });

            return keyValueClone(next);
        });
    }

    async update(ctx: Context, key: string, value: unknown, updatedAt?: number): Promise<KeyValueDbRecord | null> {
        const normalizedKey = keyNormalize(key);
        if (!normalizedKey) {
            throw new Error("key is required.");
        }
        if (value === undefined) {
            throw new Error("value is required.");
        }

        const lock = this.keyLockFor(ctx.userId, normalizedKey);
        return lock.inLock(async () => {
            const existing = await this.findByKey(ctx, normalizedKey);
            if (!existing) {
                return null;
            }

            const now = timestampResolve(updatedAt) ?? Date.now();
            const next = await this.db.transaction(async (tx) =>
                versionAdvance<KeyValueDbRecord>({
                    now,
                    changes: {
                        value: structuredClone(value),
                        createdAt: existing.createdAt,
                        updatedAt: now
                    },
                    findCurrent: async () => existing,
                    closeCurrent: async (current, closeAt) => {
                        const closedRows = await tx
                            .update(keyValuesTable)
                            .set({ validTo: closeAt })
                            .where(
                                and(
                                    eq(keyValuesTable.userId, current.userId),
                                    eq(keyValuesTable.key, current.key),
                                    eq(keyValuesTable.version, current.version ?? 1),
                                    isNull(keyValuesTable.validTo)
                                )
                            )
                            .returning({ version: keyValuesTable.version });
                        return closedRows.length;
                    },
                    insertNext: async (row) => {
                        await tx.insert(keyValuesTable).values({
                            userId: row.userId,
                            key: row.key,
                            version: row.version ?? 1,
                            validFrom: row.validFrom ?? row.createdAt,
                            validTo: row.validTo ?? null,
                            value: row.value,
                            createdAt: row.createdAt,
                            updatedAt: row.updatedAt
                        });
                    }
                })
            );

            return keyValueClone(next);
        });
    }

    async delete(ctx: Context, key: string): Promise<boolean> {
        const normalizedKey = keyNormalize(key);
        if (!normalizedKey) {
            return false;
        }

        const lock = this.keyLockFor(ctx.userId, normalizedKey);
        return lock.inLock(async () => {
            const existing = await this.findByKey(ctx, normalizedKey);
            if (!existing) {
                return false;
            }

            await this.db
                .update(keyValuesTable)
                .set({ validTo: Date.now() })
                .where(
                    and(
                        eq(keyValuesTable.userId, existing.userId),
                        eq(keyValuesTable.key, existing.key),
                        eq(keyValuesTable.version, existing.version ?? 1),
                        isNull(keyValuesTable.validTo)
                    )
                );
            return true;
        });
    }

    private async keyLoadLatestByKey(userId: string, key: string): Promise<KeyValueDbRecord | null> {
        const rows = await this.db
            .select()
            .from(keyValuesTable)
            .where(and(eq(keyValuesTable.userId, userId), eq(keyValuesTable.key, key)))
            .orderBy(desc(keyValuesTable.version))
            .limit(1);
        const row = rows[0];
        if (!row) {
            return null;
        }
        return keyValueParse(row);
    }

    private keyLockFor(userId: string, key: string): AsyncLock {
        const lockKey = `${userId}\u0000${key}`;
        const existing = this.keyLocks.get(lockKey);
        if (existing) {
            return existing;
        }
        const created = new AsyncLock();
        this.keyLocks.set(lockKey, created);
        return created;
    }
}

function keyValueParse(row: typeof keyValuesTable.$inferSelect): KeyValueDbRecord {
    return {
        userId: row.userId,
        key: row.key,
        version: row.version ?? 1,
        validFrom: row.validFrom ?? row.createdAt,
        validTo: row.validTo ?? null,
        value: structuredClone(row.value),
        createdAt: row.createdAt,
        updatedAt: row.updatedAt
    };
}

function keyValueClone(row: KeyValueDbRecord): KeyValueDbRecord {
    return {
        userId: row.userId,
        key: row.key,
        version: row.version ?? 1,
        validFrom: row.validFrom ?? row.createdAt,
        validTo: row.validTo ?? null,
        value: structuredClone(row.value),
        createdAt: row.createdAt,
        updatedAt: row.updatedAt
    };
}

function keyNormalize(value: string): string {
    return value.trim();
}

function timestampResolve(value: number | undefined): number | null {
    if (value === undefined) {
        return null;
    }
    return Number.isFinite(value) ? Math.floor(value) : null;
}
