import type { StorageDatabase as DatabaseSync } from "./databaseOpen.js";
import type { Context } from "@/types";
import { AsyncLock } from "../util/lock.js";
import type { DatabaseDelayedSignalRow, DelayedSignalDbRecord } from "./databaseTypes.js";

/**
 * Delayed signals repository backed by SQLite with write-through caching.
 * Expects: schema migrations already applied for signals_delayed.
 */
export class DelayedSignalsRepository {
    private readonly db: DatabaseSync;
    private readonly signalsById = new Map<string, DelayedSignalDbRecord>();
    private readonly signalLocks = new Map<string, AsyncLock>();
    private readonly cacheLock = new AsyncLock();
    private readonly createLock = new AsyncLock();
    private allSignalsLoaded = false;

    constructor(db: DatabaseSync) {
        this.db = db;
    }

    async create(record: DelayedSignalDbRecord): Promise<void> {
        await this.createLock.inLock(async () => {
            this.db.exec("BEGIN");
            try {
                if (record.repeatKey) {
                    this.db
                        .prepare(
                            "DELETE FROM signals_delayed WHERE user_id = ? AND type = ? AND repeat_key = ? AND id <> ?"
                        )
                        .run(record.userId, record.type, record.repeatKey, record.id);
                }

                this.db
                    .prepare(
                        `
                      INSERT INTO signals_delayed (
                        id,
                        user_id,
                        type,
                        deliver_at,
                        source,
                        data,
                        repeat_key,
                        created_at,
                        updated_at
                      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                      ON CONFLICT(id) DO UPDATE SET
                        user_id = excluded.user_id,
                        type = excluded.type,
                        deliver_at = excluded.deliver_at,
                        source = excluded.source,
                        data = excluded.data,
                        repeat_key = excluded.repeat_key,
                        created_at = excluded.created_at,
                        updated_at = excluded.updated_at
                    `
                    )
                    .run(
                        record.id,
                        record.userId,
                        record.type,
                        record.deliverAt,
                        JSON.stringify(record.source),
                        record.data === undefined ? null : JSON.stringify(record.data),
                        record.repeatKey,
                        record.createdAt,
                        record.updatedAt
                    );
                this.db.exec("COMMIT");
            } catch (error) {
                this.db.exec("ROLLBACK");
                throw error;
            }

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
            const loaded = this.signalLoadById(id);
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
        const rows = this.db
            .prepare("SELECT * FROM signals_delayed WHERE deliver_at <= ? ORDER BY deliver_at ASC, id ASC")
            .all(now) as DatabaseDelayedSignalRow[];
        const parsed = rows.map((row) => this.signalParse(row));

        await this.cacheLock.inLock(() => {
            for (const record of parsed) {
                this.signalCacheSet(record);
            }
        });

        return parsed.map((entry) => delayedSignalClone(entry));
    }

    async findMany(ctx: Context): Promise<DelayedSignalDbRecord[]> {
        const userId = contextUserIdRequire(ctx);
        const rows = this.db
            .prepare("SELECT * FROM signals_delayed WHERE user_id = ? ORDER BY deliver_at ASC, id ASC")
            .all(userId) as DatabaseDelayedSignalRow[];
        const parsed = rows.map((row) => this.signalParse(row));

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

        const rows = this.db
            .prepare("SELECT * FROM signals_delayed ORDER BY deliver_at ASC, id ASC")
            .all() as DatabaseDelayedSignalRow[];
        const parsed = rows.map((row) => this.signalParse(row));

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
            const removed = this.db.prepare("DELETE FROM signals_delayed WHERE id = ?").run(id);
            const rawChanges = (removed as { changes?: number | bigint }).changes;
            const changes = typeof rawChanges === "bigint" ? Number(rawChanges) : (rawChanges ?? 0);
            await this.cacheLock.inLock(() => {
                this.signalsById.delete(id);
            });
            return changes > 0;
        });
    }

    async deleteByRepeatKey(ctx: Context, type: string, repeatKey: string): Promise<number> {
        const normalizedUserId = contextUserIdRequire(ctx);
        const removed = this.db
            .prepare("DELETE FROM signals_delayed WHERE user_id = ? AND type = ? AND repeat_key = ?")
            .run(normalizedUserId, type, repeatKey);
        const rawChanges = (removed as { changes?: number | bigint }).changes;
        const changes = typeof rawChanges === "bigint" ? Number(rawChanges) : (rawChanges ?? 0);

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

    private signalLoadById(id: string): DelayedSignalDbRecord | null {
        const row = this.db.prepare("SELECT * FROM signals_delayed WHERE id = ? LIMIT 1").get(id) as
            | DatabaseDelayedSignalRow
            | undefined;
        if (!row) {
            return null;
        }
        return this.signalParse(row);
    }

    private signalParse(row: DatabaseDelayedSignalRow): DelayedSignalDbRecord {
        return {
            id: row.id,
            userId: row.user_id,
            type: row.type,
            deliverAt: row.deliver_at,
            source: sourceParse(row.source),
            data: dataParse(row.data),
            repeatKey: row.repeat_key,
            createdAt: row.created_at,
            updatedAt: row.updated_at
        };
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
        source: JSON.parse(JSON.stringify(record.source)) as DelayedSignalDbRecord["source"],
        data: record.data === undefined ? undefined : (JSON.parse(JSON.stringify(record.data)) as unknown)
    };
}

function sourceParse(raw: string): DelayedSignalDbRecord["source"] {
    try {
        return JSON.parse(raw) as DelayedSignalDbRecord["source"];
    } catch {
        return { type: "system", userId: "unknown" };
    }
}

function dataParse(raw: string | null): unknown {
    if (raw === null) {
        return undefined;
    }
    try {
        return JSON.parse(raw) as unknown;
    } catch {
        return undefined;
    }
}
