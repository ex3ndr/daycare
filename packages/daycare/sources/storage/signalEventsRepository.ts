import type { StorageDatabase as DatabaseSync } from "./databaseOpen.js";
import type { Context } from "@/types";
import type { SQLInputValue } from "node:sqlite";
import { AsyncLock } from "../util/lock.js";
import type { DatabaseSignalEventRow, SignalEventDbRecord } from "./databaseTypes.js";

export type SignalEventsFindManyOptions = {
    type?: string;
    limit?: number;
    offset?: number;
};

type SignalEventsQueryOptions = SignalEventsFindManyOptions & {
    userId?: string;
};

/**
 * Signal events repository backed by SQLite with write-through caching.
 * Expects: schema migrations already applied for signals_events.
 */
export class SignalEventsRepository {
    private readonly db: DatabaseSync;
    private readonly eventsById = new Map<string, SignalEventDbRecord>();
    private readonly eventLocks = new Map<string, AsyncLock>();
    private readonly cacheLock = new AsyncLock();
    private readonly createLock = new AsyncLock();
    private allEventsLoaded = false;

    constructor(db: DatabaseSync) {
        this.db = db;
    }

    async create(record: SignalEventDbRecord): Promise<void> {
        await this.createLock.inLock(async () => {
            this.db
                .prepare(
                    `
                  INSERT INTO signals_events (
                    id,
                    user_id,
                    type,
                    source,
                    data,
                    created_at
                  ) VALUES (?, ?, ?, ?, ?, ?)
                  ON CONFLICT(id) DO UPDATE SET
                    user_id = excluded.user_id,
                    type = excluded.type,
                    source = excluded.source,
                    data = excluded.data,
                    created_at = excluded.created_at
                `
                )
                .run(
                    record.id,
                    record.userId,
                    record.type,
                    JSON.stringify(record.source),
                    record.data === undefined ? null : JSON.stringify(record.data),
                    record.createdAt
                );

            await this.cacheLock.inLock(() => {
                this.eventCacheSet(record);
            });
        });
    }

    async findMany(ctx: Context, options: SignalEventsFindManyOptions = {}): Promise<SignalEventDbRecord[]> {
        return this.findAll({ ...options, userId: ctx.userId });
    }

    async findAll(options: SignalEventsQueryOptions = {}): Promise<SignalEventDbRecord[]> {
        const limit = numberLimitResolve(options.limit);
        const offset = numberOffsetResolve(options.offset);
        const hasFilter = Boolean(options.userId) || Boolean(options.type) || limit !== null || offset > 0;

        if (!hasFilter && this.allEventsLoaded) {
            return signalEventsSort(Array.from(this.eventsById.values())).map((event) => signalEventClone(event));
        }

        const where: string[] = [];
        const values: SQLInputValue[] = [];
        if (options.userId) {
            where.push("user_id = ?");
            values.push(options.userId);
        }
        if (options.type) {
            where.push("type = ?");
            values.push(options.type);
        }

        let sql = "SELECT * FROM signals_events";
        if (where.length > 0) {
            sql += ` WHERE ${where.join(" AND ")}`;
        }
        sql += " ORDER BY created_at ASC, rowid ASC";
        if (limit !== null) {
            sql += " LIMIT ?";
            values.push(limit);
        }
        if (offset > 0) {
            sql += " OFFSET ?";
            values.push(offset);
        }

        const rows = this.db.prepare(sql).all(...values) as DatabaseSignalEventRow[];
        const parsed = rows.map((row) => this.eventParse(row));

        if (!hasFilter) {
            await this.cacheLock.inLock(() => {
                for (const record of parsed) {
                    this.eventCacheSet(record);
                }
                this.allEventsLoaded = true;
            });
        }

        return parsed.map((event) => signalEventClone(event));
    }

    async findRecent(ctx: Context, limit = 200): Promise<SignalEventDbRecord[]> {
        const normalizedLimit = Math.min(1000, Math.max(1, Math.floor(limit)));
        const rows = this.db
            .prepare("SELECT * FROM signals_events WHERE user_id = ? ORDER BY created_at DESC, rowid DESC LIMIT ?")
            .all(ctx.userId, normalizedLimit) as DatabaseSignalEventRow[];
        const parsed = rows.map((row) => this.eventParse(row)).reverse();
        return parsed.map((event) => signalEventClone(event));
    }

    async findRecentAll(limit = 200): Promise<SignalEventDbRecord[]> {
        const normalizedLimit = Math.min(1000, Math.max(1, Math.floor(limit)));

        if (this.allEventsLoaded) {
            const all = signalEventsSort(Array.from(this.eventsById.values()));
            if (all.length <= normalizedLimit) {
                return all.map((event) => signalEventClone(event));
            }
            return all.slice(all.length - normalizedLimit).map((event) => signalEventClone(event));
        }

        const rows = this.db
            .prepare("SELECT * FROM signals_events ORDER BY created_at DESC, rowid DESC LIMIT ?")
            .all(normalizedLimit) as DatabaseSignalEventRow[];
        const parsed = rows.map((row) => this.eventParse(row)).reverse();
        return parsed.map((event) => signalEventClone(event));
    }

    async findById(id: string): Promise<SignalEventDbRecord | null> {
        const cached = await this.cacheLock.inLock(() => {
            const existing = this.eventsById.get(id);
            if (existing) {
                return signalEventClone(existing);
            }
            if (this.allEventsLoaded) {
                return null;
            }
            return undefined;
        });
        if (cached !== undefined) {
            return cached;
        }

        const lock = this.eventLockForId(id);
        return lock.inLock(async () => {
            const existing = await this.cacheLock.inLock(() => {
                const record = this.eventsById.get(id);
                return record ? signalEventClone(record) : null;
            });
            if (existing) {
                return existing;
            }
            const loaded = this.eventLoadById(id);
            if (!loaded) {
                return null;
            }
            await this.cacheLock.inLock(() => {
                this.eventCacheSet(loaded);
            });
            return signalEventClone(loaded);
        });
    }

    private eventCacheSet(record: SignalEventDbRecord): void {
        this.eventsById.set(record.id, signalEventClone(record));
    }

    private eventLoadById(id: string): SignalEventDbRecord | null {
        const row = this.db.prepare("SELECT * FROM signals_events WHERE id = ? LIMIT 1").get(id) as
            | DatabaseSignalEventRow
            | undefined;
        if (!row) {
            return null;
        }
        return this.eventParse(row);
    }

    private eventParse(row: DatabaseSignalEventRow): SignalEventDbRecord {
        return {
            id: row.id,
            userId: row.user_id,
            type: row.type,
            source: sourceParse(row.source),
            data: dataParse(row.data),
            createdAt: row.created_at
        };
    }

    private eventLockForId(eventId: string): AsyncLock {
        const existing = this.eventLocks.get(eventId);
        if (existing) {
            return existing;
        }
        const lock = new AsyncLock();
        this.eventLocks.set(eventId, lock);
        return lock;
    }
}

function sourceParse(raw: string): SignalEventDbRecord["source"] {
    try {
        return JSON.parse(raw) as SignalEventDbRecord["source"];
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

function signalEventClone(record: SignalEventDbRecord): SignalEventDbRecord {
    return {
        ...record,
        source: JSON.parse(JSON.stringify(record.source)) as SignalEventDbRecord["source"],
        data: record.data === undefined ? undefined : (JSON.parse(JSON.stringify(record.data)) as unknown)
    };
}

function signalEventsSort(records: SignalEventDbRecord[]): SignalEventDbRecord[] {
    return records.slice().sort((left, right) => left.createdAt - right.createdAt);
}

function numberLimitResolve(value: number | undefined): number | null {
    if (value === undefined) {
        return null;
    }
    if (!Number.isFinite(value)) {
        return null;
    }
    return Math.max(1, Math.floor(value));
}

function numberOffsetResolve(value: number | undefined): number {
    if (value === undefined || !Number.isFinite(value)) {
        return 0;
    }
    return Math.max(0, Math.floor(value));
}
