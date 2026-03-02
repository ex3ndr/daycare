import { and, asc, eq, lte, ne } from "drizzle-orm";
import type { Context } from "@/types";
import type { DaycareDb } from "../schema.js";
import { signalsDelayedTable } from "../schema.js";
import { AsyncLock } from "../utils/lock.js";
import type { DelayedSignalDbRecord } from "./databaseTypes.js";

/**
 * Delayed signals repository backed by Drizzle with write-through caching.
 * Expects: schema migrations already applied for signals_delayed.
 */
export class DelayedSignalsRepository {
    private readonly db: DaycareDb;
    private readonly signalsById = new Map<string, DelayedSignalDbRecord>();
    private readonly signalLocks = new Map<string, AsyncLock>();
    private readonly cacheLock = new AsyncLock();
    private readonly createLock = new AsyncLock();
    private allSignalsLoaded = false;

    constructor(db: DaycareDb) {
        this.db = db;
    }

    async create(record: DelayedSignalDbRecord): Promise<void> {
        await this.createLock.inLock(async () => {
            await this.db.transaction(async (tx) => {
                if (record.repeatKey) {
                    await tx
                        .delete(signalsDelayedTable)
                        .where(
                            and(
                                eq(signalsDelayedTable.userId, record.userId),
                                eq(signalsDelayedTable.type, record.type),
                                eq(signalsDelayedTable.repeatKey, record.repeatKey),
                                ne(signalsDelayedTable.id, record.id)
                            )
                        );
                }

                await tx
                    .insert(signalsDelayedTable)
                    .values({
                        id: record.id,
                        userId: record.userId,
                        type: record.type,
                        deliverAt: record.deliverAt,
                        source: record.source,
                        data: record.data === undefined ? null : record.data,
                        repeatKey: record.repeatKey,
                        createdAt: record.createdAt,
                        updatedAt: record.updatedAt
                    })
                    .onConflictDoUpdate({
                        target: signalsDelayedTable.id,
                        set: {
                            userId: record.userId,
                            type: record.type,
                            deliverAt: record.deliverAt,
                            source: record.source,
                            data: record.data === undefined ? null : record.data,
                            repeatKey: record.repeatKey,
                            createdAt: record.createdAt,
                            updatedAt: record.updatedAt
                        }
                    });
            });

            await this.cacheLock.inLock(() => {
                this.signalCacheSet(record);
                if (record.repeatKey) {
                    for (const [signalId, signal] of this.signalsById.entries()) {
                        if (signalId === record.id) {
                            continue;
                        }
                        if (
                            signal.userId === record.userId &&
                            signal.type === record.type &&
                            signal.repeatKey === record.repeatKey
                        ) {
                            this.signalsById.delete(signalId);
                        }
                    }
                }
            });
        });
    }

    async findById(id: string): Promise<DelayedSignalDbRecord | null> {
        const cached = this.signalsById.get(id);
        if (cached) {
            return delayedSignalClone(cached);
        }
        if (this.allSignalsLoaded) {
            return null;
        }

        const lock = this.signalLockForId(id);
        return lock.inLock(async () => {
            const existing = this.signalsById.get(id);
            if (existing) {
                return delayedSignalClone(existing);
            }
            const loaded = await this.signalLoadById(id);
            if (!loaded) {
                return null;
            }
            await this.cacheLock.inLock(() => {
                this.signalCacheSet(loaded);
            });
            return delayedSignalClone(loaded);
        });
    }

    async findDue(now: number): Promise<DelayedSignalDbRecord[]> {
        const rows = await this.db
            .select()
            .from(signalsDelayedTable)
            .where(lte(signalsDelayedTable.deliverAt, now))
            .orderBy(asc(signalsDelayedTable.deliverAt), asc(signalsDelayedTable.id));
        const parsed = rows.map((row) => signalParse(row));

        await this.cacheLock.inLock(() => {
            for (const record of parsed) {
                this.signalCacheSet(record);
            }
        });

        return parsed.map((entry) => delayedSignalClone(entry));
    }

    async findMany(ctx: Context): Promise<DelayedSignalDbRecord[]> {
        const userId = contextUserIdRequire(ctx);
        const rows = await this.db
            .select()
            .from(signalsDelayedTable)
            .where(eq(signalsDelayedTable.userId, userId))
            .orderBy(asc(signalsDelayedTable.deliverAt), asc(signalsDelayedTable.id));
        const parsed = rows.map((row) => signalParse(row));

        await this.cacheLock.inLock(() => {
            for (const record of parsed) {
                this.signalCacheSet(record);
            }
        });

        return parsed.map((entry) => delayedSignalClone(entry));
    }

    async findAll(): Promise<DelayedSignalDbRecord[]> {
        if (this.allSignalsLoaded) {
            return delayedSignalsSort(Array.from(this.signalsById.values())).map((entry) => delayedSignalClone(entry));
        }

        const rows = await this.db
            .select()
            .from(signalsDelayedTable)
            .orderBy(asc(signalsDelayedTable.deliverAt), asc(signalsDelayedTable.id));
        const parsed = rows.map((row) => signalParse(row));

        await this.cacheLock.inLock(() => {
            for (const record of parsed) {
                this.signalCacheSet(record);
            }
            this.allSignalsLoaded = true;
        });

        return parsed.map((entry) => delayedSignalClone(entry));
    }

    async delete(id: string): Promise<boolean> {
        const lock = this.signalLockForId(id);
        return lock.inLock(async () => {
            const result = await this.db
                .delete(signalsDelayedTable)
                .where(eq(signalsDelayedTable.id, id))
                .returning({ id: signalsDelayedTable.id });
            await this.cacheLock.inLock(() => {
                this.signalsById.delete(id);
            });
            return result.length > 0;
        });
    }

    async deleteByRepeatKey(ctx: Context, type: string, repeatKey: string): Promise<number> {
        const normalizedUserId = contextUserIdRequire(ctx);
        const result = await this.db
            .delete(signalsDelayedTable)
            .where(
                and(
                    eq(signalsDelayedTable.userId, normalizedUserId),
                    eq(signalsDelayedTable.type, type),
                    eq(signalsDelayedTable.repeatKey, repeatKey)
                )
            )
            .returning({ id: signalsDelayedTable.id });
        const changes = result.length;

        if (changes > 0) {
            await this.cacheLock.inLock(() => {
                for (const [signalId, signal] of this.signalsById.entries()) {
                    if (signal.userId === normalizedUserId && signal.type === type && signal.repeatKey === repeatKey) {
                        this.signalsById.delete(signalId);
                    }
                }
            });
        }

        return changes;
    }

    private signalCacheSet(record: DelayedSignalDbRecord): void {
        this.signalsById.set(record.id, delayedSignalClone(record));
    }

    private async signalLoadById(id: string): Promise<DelayedSignalDbRecord | null> {
        const rows = await this.db.select().from(signalsDelayedTable).where(eq(signalsDelayedTable.id, id)).limit(1);
        const row = rows[0];
        if (!row) {
            return null;
        }
        return signalParse(row);
    }

    private signalLockForId(signalId: string): AsyncLock {
        const existing = this.signalLocks.get(signalId);
        if (existing) {
            return existing;
        }
        const lock = new AsyncLock();
        this.signalLocks.set(signalId, lock);
        return lock;
    }
}

/** Converts a Drizzle row (camelCase) to the application record type. */
function signalParse(row: {
    id: string;
    userId: string;
    type: string;
    deliverAt: number;
    source: unknown;
    data: unknown | null;
    repeatKey: string | null;
    createdAt: number;
    updatedAt: number;
}): DelayedSignalDbRecord {
    return {
        id: row.id,
        userId: row.userId,
        type: row.type,
        deliverAt: row.deliverAt,
        source: sourceParse(row.source),
        data: dataParse(row.data),
        repeatKey: row.repeatKey,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt
    };
}

function delayedSignalsSort(records: DelayedSignalDbRecord[]): DelayedSignalDbRecord[] {
    return records.slice().sort((left, right) => left.deliverAt - right.deliverAt || left.id.localeCompare(right.id));
}

function contextUserIdRequire(ctx: Context): string {
    const userIdRaw = (ctx as unknown as { userId?: unknown }).userId;
    if (typeof userIdRaw !== "string") {
        throw new Error("Delayed signal context userId is required.");
    }
    const userId = userIdRaw.trim();
    if (!userId) {
        throw new Error("Delayed signal context userId is required.");
    }
    return userId;
}

function delayedSignalClone(record: DelayedSignalDbRecord): DelayedSignalDbRecord {
    return {
        ...record,
        source: structuredClone(record.source),
        data: record.data === undefined ? undefined : structuredClone(record.data)
    };
}

function sourceParse(raw: unknown): DelayedSignalDbRecord["source"] {
    try {
        return jsonValueParse(raw) as DelayedSignalDbRecord["source"];
    } catch {
        return { type: "system", userId: "unknown" };
    }
}

function dataParse(raw: unknown | null): unknown {
    if (raw === null) {
        return undefined;
    }
    try {
        return jsonValueParse(raw);
    } catch {
        return undefined;
    }
}

function jsonValueParse(raw: unknown): unknown {
    if (typeof raw === "string") {
        return JSON.parse(raw);
    }
    return raw;
}
