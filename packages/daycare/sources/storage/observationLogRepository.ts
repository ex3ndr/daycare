import { and, asc, desc, eq, gte, like, lt, sql } from "drizzle-orm";
import type { Context } from "@/types";
import type { DaycareDb } from "../schema.js";
import { observationLogTable } from "../schema.js";
import type {
    ObservationLogDbRecord,
    ObservationLogFindOptions,
    ObservationLogRecentOptions
} from "./databaseTypes.js";

/**
 * Append-only observation log repository backed by Drizzle.
 * No in-memory caching — queries always hit the database.
 * Scope IDs stored as a native PG text[] column with GIN index for fast overlap queries.
 * Expects: schema migrations already applied for observation_log table.
 */
export class ObservationLogRepository {
    private readonly db: DaycareDb;

    constructor(db: DaycareDb) {
        this.db = db;
    }

    /** Appends a single observation. */
    async append(record: ObservationLogDbRecord): Promise<void> {
        await this.db.insert(observationLogTable).values({
            id: record.id,
            userId: record.userId,
            type: record.type,
            source: record.source,
            message: record.message,
            details: record.details,
            data: record.data === undefined || record.data === null ? null : JSON.stringify(record.data),
            scopeIds: record.scopeIds,
            createdAt: record.createdAt
        });
    }

    /**
     * Queries observations for a user with optional filters.
     * scopeIds filter uses PG array overlap (&&) — matches events tagged with ANY of the provided IDs.
     * source filter uses prefix match (e.g. "agent:" matches all agent sources).
     */
    async findMany(ctx: Context, options: ObservationLogFindOptions = {}): Promise<ObservationLogDbRecord[]> {
        const limit = numberLimitResolve(options.limit);
        const offset = numberOffsetResolve(options.offset);
        const conditions = conditionsBuild(ctx.userId, options);

        let query = this.db
            .select()
            .from(observationLogTable)
            .where(and(...conditions))
            .orderBy(asc(observationLogTable.createdAt), asc(observationLogTable.id))
            .$dynamic();

        if (limit !== null) {
            query = query.limit(limit);
        }
        if (offset > 0) {
            query = query.offset(offset);
        }

        const rows = await query;
        return rows.map(rowParse);
    }

    /**
     * Returns most recent N observations for a user, optionally filtered.
     * Default limit: 100, max: 1000.
     */
    async findRecent(ctx: Context, options: ObservationLogRecentOptions = {}): Promise<ObservationLogDbRecord[]> {
        const limit = Math.min(1000, Math.max(1, Math.floor(options.limit ?? 100)));
        const conditions = conditionsBuild(ctx.userId, options);

        const rows = await this.db
            .select()
            .from(observationLogTable)
            .where(and(...conditions))
            .orderBy(desc(observationLogTable.createdAt), desc(observationLogTable.id))
            .limit(limit);

        // Reverse so results are chronological (oldest first)
        rows.reverse();
        return rows.map(rowParse);
    }
}

/** Builds WHERE conditions from userId and filter options. */
function conditionsBuild(userId: string, options: ObservationLogFindOptions & ObservationLogRecentOptions) {
    const conditions = [eq(observationLogTable.userId, userId)];
    if (options.type) {
        conditions.push(eq(observationLogTable.type, options.type));
    }
    if (options.source) {
        conditions.push(like(observationLogTable.source, `${options.source}%`));
    }
    if (options.scopeIds && options.scopeIds.length > 0) {
        // PG array overlap: scope_ids && ARRAY['id1','id2']::text[]
        const arrayLiteral = `{${options.scopeIds.map((id) => `"${id.replace(/["\\]/g, "")}"`).join(",")}}`;
        conditions.push(sql`${observationLogTable.scopeIds} && ${arrayLiteral}::text[]`);
    }
    if (options.afterDate !== undefined) {
        conditions.push(gte(observationLogTable.createdAt, options.afterDate));
    }
    if (options.beforeDate !== undefined) {
        conditions.push(lt(observationLogTable.createdAt, options.beforeDate));
    }
    return conditions;
}

function rowParse(row: {
    id: string;
    userId: string;
    type: string;
    source: string;
    message: string;
    details: string | null;
    data: string | null;
    scopeIds: string[] | null;
    createdAt: number;
}): ObservationLogDbRecord {
    return {
        id: row.id,
        userId: row.userId,
        type: row.type,
        source: row.source,
        message: row.message,
        details: row.details,
        data: dataParse(row.data),
        scopeIds: row.scopeIds ?? [],
        createdAt: row.createdAt
    };
}

function dataParse(raw: string | null): unknown {
    if (raw === null) {
        return null;
    }
    try {
        return JSON.parse(raw) as unknown;
    } catch {
        return null;
    }
}

function numberLimitResolve(value: number | undefined): number | null {
    if (value === undefined || !Number.isFinite(value)) {
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
