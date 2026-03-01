import { and, asc, desc, eq, gte, inArray, like, lt } from "drizzle-orm";
import type { Context } from "@/types";
import type { DaycareDb } from "../schema.js";
import { observationLogScopesTable, observationLogTable } from "../schema.js";
import type {
    ObservationLogDbRecord,
    ObservationLogFindOptions,
    ObservationLogRecentOptions
} from "./databaseTypes.js";

/**
 * Append-only observation log repository backed by Drizzle.
 * No in-memory caching — queries always hit the database.
 * Expects: schema migrations already applied for observation_log tables.
 */
export class ObservationLogRepository {
    private readonly db: DaycareDb;

    constructor(db: DaycareDb) {
        this.db = db;
    }

    /** Appends a single observation with its scope IDs in one transaction. */
    async append(record: ObservationLogDbRecord): Promise<void> {
        await this.db.transaction(async (tx) => {
            await tx.insert(observationLogTable).values({
                id: record.id,
                userId: record.userId,
                type: record.type,
                source: record.source,
                message: record.message,
                details: record.details,
                data: record.data === undefined || record.data === null ? null : JSON.stringify(record.data),
                createdAt: record.createdAt
            });

            if (record.scopeIds.length > 0) {
                await tx.insert(observationLogScopesTable).values(
                    record.scopeIds.map((scopeId) => ({
                        observationId: record.id,
                        scopeId
                    }))
                );
            }
        });
    }

    /**
     * Queries observations for a user with optional filters.
     * scopeIds filter matches events tagged with ANY of the provided IDs.
     * source filter uses prefix match (e.g. "agent:" matches all agent sources).
     */
    async findMany(ctx: Context, options: ObservationLogFindOptions = {}): Promise<ObservationLogDbRecord[]> {
        const limit = numberLimitResolve(options.limit);
        const offset = numberOffsetResolve(options.offset);

        // When filtering by scope, we need a subquery for matching observation IDs
        let scopeSubqueryIds: string[] | null = null;
        if (options.scopeIds && options.scopeIds.length > 0) {
            const scopeRows = await this.db
                .select({ observationId: observationLogScopesTable.observationId })
                .from(observationLogScopesTable)
                .where(inArray(observationLogScopesTable.scopeId, options.scopeIds));
            scopeSubqueryIds = [...new Set(scopeRows.map((row) => row.observationId))];
            if (scopeSubqueryIds.length === 0) {
                return [];
            }
        }

        const conditions = [eq(observationLogTable.userId, ctx.userId)];
        if (options.type) {
            conditions.push(eq(observationLogTable.type, options.type));
        }
        if (options.source) {
            conditions.push(like(observationLogTable.source, `${options.source}%`));
        }
        if (scopeSubqueryIds) {
            conditions.push(inArray(observationLogTable.id, scopeSubqueryIds));
        }
        if (options.afterDate !== undefined) {
            conditions.push(gte(observationLogTable.createdAt, options.afterDate));
        }
        if (options.beforeDate !== undefined) {
            conditions.push(lt(observationLogTable.createdAt, options.beforeDate));
        }

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
        return this.rowsPopulateScopeIds(rows);
    }

    /**
     * Returns most recent N observations for a user, optionally filtered.
     * Default limit: 100, max: 1000.
     */
    async findRecent(ctx: Context, options: ObservationLogRecentOptions = {}): Promise<ObservationLogDbRecord[]> {
        const limit = Math.min(1000, Math.max(1, Math.floor(options.limit ?? 100)));

        let scopeSubqueryIds: string[] | null = null;
        if (options.scopeIds && options.scopeIds.length > 0) {
            const scopeRows = await this.db
                .select({ observationId: observationLogScopesTable.observationId })
                .from(observationLogScopesTable)
                .where(inArray(observationLogScopesTable.scopeId, options.scopeIds));
            scopeSubqueryIds = [...new Set(scopeRows.map((row) => row.observationId))];
            if (scopeSubqueryIds.length === 0) {
                return [];
            }
        }

        const conditions = [eq(observationLogTable.userId, ctx.userId)];
        if (options.type) {
            conditions.push(eq(observationLogTable.type, options.type));
        }
        if (options.source) {
            conditions.push(like(observationLogTable.source, `${options.source}%`));
        }
        if (scopeSubqueryIds) {
            conditions.push(inArray(observationLogTable.id, scopeSubqueryIds));
        }

        const rows = await this.db
            .select()
            .from(observationLogTable)
            .where(and(...conditions))
            .orderBy(desc(observationLogTable.createdAt), desc(observationLogTable.id))
            .limit(limit);

        // Reverse so results are chronological (oldest first)
        rows.reverse();
        return this.rowsPopulateScopeIds(rows);
    }

    /** Populates scopeIds on a set of observation log rows by batch-loading from the scopes table. */
    private async rowsPopulateScopeIds(
        rows: {
            id: string;
            userId: string;
            type: string;
            source: string;
            message: string;
            details: string | null;
            data: string | null;
            createdAt: number;
        }[]
    ): Promise<ObservationLogDbRecord[]> {
        if (rows.length === 0) {
            return [];
        }

        const ids = rows.map((row) => row.id);
        const scopeRows = await this.db
            .select()
            .from(observationLogScopesTable)
            .where(inArray(observationLogScopesTable.observationId, ids));

        const scopeMap = new Map<string, string[]>();
        for (const scope of scopeRows) {
            const existing = scopeMap.get(scope.observationId);
            if (existing) {
                existing.push(scope.scopeId);
            } else {
                scopeMap.set(scope.observationId, [scope.scopeId]);
            }
        }

        return rows.map((row) => rowParse(row, scopeMap.get(row.id) ?? []));
    }
}

function rowParse(
    row: {
        id: string;
        userId: string;
        type: string;
        source: string;
        message: string;
        details: string | null;
        data: string | null;
        createdAt: number;
    },
    scopeIds: string[]
): ObservationLogDbRecord {
    return {
        id: row.id,
        userId: row.userId,
        type: row.type,
        source: row.source,
        message: row.message,
        details: row.details,
        data: dataParse(row.data),
        scopeIds,
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
