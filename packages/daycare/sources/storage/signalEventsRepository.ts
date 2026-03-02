import { and, asc, desc, eq } from "drizzle-orm";
import type { Context } from "@/types";
import type { DaycareDb } from "../schema.js";
import { signalsEventsTable } from "../schema.js";
import { AsyncLock } from "../utils/lock.js";
import type { SignalEventDbRecord } from "./databaseTypes.js";

export type SignalEventsFindManyOptions = {
    type?: string;
    limit?: number;
    offset?: number;
};

type SignalEventsQueryOptions = SignalEventsFindManyOptions & {
    userId?: string;
};

/**
 * Signal events repository backed by Drizzle with write-through caching.
 * Expects: schema migrations already applied for signals_events.
 */
export class SignalEventsRepository {
    private readonly db: DaycareDb;
    private readonly eventsById = new Map<string, SignalEventDbRecord>();
    private readonly eventLocks = new Map<string, AsyncLock>();
    private readonly cacheLock = new AsyncLock();
    private readonly createLock = new AsyncLock();
    private allEventsLoaded = false;

    constructor(db: DaycareDb) {
        this.db = db;
    }

    async create(record: SignalEventDbRecord): Promise<void> {
        await this.createLock.inLock(async () => {
            await this.db
                .insert(signalsEventsTable)
                .values({
                    id: record.id,
                    userId: record.userId,
                    type: record.type,
                    source: record.source,
                    data: record.data === undefined ? null : record.data,
                    createdAt: record.createdAt
                })
                .onConflictDoUpdate({
                    target: signalsEventsTable.id,
                    set: {
                        userId: record.userId,
                        type: record.type,
                        source: record.source,
                        data: record.data === undefined ? null : record.data,
                        createdAt: record.createdAt
                    }
                });

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

        // Build dynamic WHERE conditions
        const conditions = [];
        if (options.userId) {
            conditions.push(eq(signalsEventsTable.userId, options.userId));
        }
        if (options.type) {
            conditions.push(eq(signalsEventsTable.type, options.type));
        }

        let query = this.db
            .select()
            .from(signalsEventsTable)
            .where(conditions.length > 0 ? and(...conditions) : undefined)
            .orderBy(asc(signalsEventsTable.createdAt), asc(signalsEventsTable.id))
            .$dynamic();

        if (limit !== null) {
            query = query.limit(limit);
        }
        if (offset > 0) {
            query = query.offset(offset);
        }

        const rows = await query;
        const parsed = rows.map((row) => eventParse(row));

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
        const rows = await this.db
            .select()
            .from(signalsEventsTable)
            .where(eq(signalsEventsTable.userId, ctx.userId))
            .orderBy(desc(signalsEventsTable.createdAt), desc(signalsEventsTable.id))
            .limit(normalizedLimit);
        const parsed = rows.map((row) => eventParse(row)).reverse();
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

        const rows = await this.db
            .select()
            .from(signalsEventsTable)
            .orderBy(desc(signalsEventsTable.createdAt), desc(signalsEventsTable.id))
            .limit(normalizedLimit);
        const parsed = rows.map((row) => eventParse(row)).reverse();
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
            const loaded = await this.eventLoadById(id);
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

    private async eventLoadById(id: string): Promise<SignalEventDbRecord | null> {
        const rows = await this.db.select().from(signalsEventsTable).where(eq(signalsEventsTable.id, id)).limit(1);
        const row = rows[0];
        if (!row) {
            return null;
        }
        return eventParse(row);
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

/** Converts a Drizzle row (camelCase) to the application record type. */
function eventParse(row: {
    id: string;
    userId: string;
    type: string;
    source: unknown;
    data: unknown | null;
    createdAt: number;
}): SignalEventDbRecord {
    return {
        id: row.id,
        userId: row.userId,
        type: row.type,
        source: sourceParse(row.source),
        data: dataParse(row.data),
        createdAt: row.createdAt
    };
}

function sourceParse(raw: unknown): SignalEventDbRecord["source"] {
    try {
        return jsonValueParse(raw) as SignalEventDbRecord["source"];
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

function signalEventClone(record: SignalEventDbRecord): SignalEventDbRecord {
    return {
        ...record,
        source: structuredClone(record.source),
        data: record.data === undefined ? undefined : structuredClone(record.data)
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

function jsonValueParse(raw: unknown): unknown {
    if (typeof raw === "string") {
        return JSON.parse(raw);
    }
    return raw;
}
