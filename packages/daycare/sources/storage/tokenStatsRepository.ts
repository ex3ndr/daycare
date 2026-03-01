import { and, asc, eq, gte, lte, sql } from "drizzle-orm";
import type { Context } from "@/types";
import type { DaycareDb } from "../schema.js";
import { tokenStatsHourlyTable } from "../schema.js";
import type { TokenStatsHourlyDbRecord } from "./databaseTypes.js";

const HOUR_MS = 60 * 60 * 1000;

export type TokenStatsIncrementInput = {
    at?: number;
    model: string;
    input: number;
    output: number;
    cacheRead: number;
    cacheWrite: number;
    cost: number;
};

export type TokenStatsFindManyOptions = {
    from?: number;
    to?: number;
    userId?: string;
    agentId?: string;
    model?: string;
    limit?: number;
};

/**
 * Repository for hourly token/cost rollups keyed by user, agent, and model.
 * Expects: schema migrations already applied for token_stats_hourly.
 */
export class TokenStatsRepository {
    private readonly db: DaycareDb;

    constructor(db: DaycareDb) {
        this.db = db;
    }

    async increment(ctx: Context, input: TokenStatsIncrementInput): Promise<void> {
        const model = input.model.trim();
        if (model.length === 0) {
            return;
        }
        const inputTokens = numberTokenNormalize(input.input);
        const outputTokens = numberTokenNormalize(input.output);
        const cacheReadTokens = numberTokenNormalize(input.cacheRead);
        const cacheWriteTokens = numberTokenNormalize(input.cacheWrite);
        const cost = numberCostNormalize(input.cost);
        if (inputTokens === 0 && outputTokens === 0 && cacheReadTokens === 0 && cacheWriteTokens === 0 && cost <= 0) {
            return;
        }
        const hourStart = hourStartResolve(input.at ?? Date.now());

        await this.db
            .insert(tokenStatsHourlyTable)
            .values({
                hourStart,
                userId: ctx.userId,
                agentId: ctx.agentId,
                model,
                inputTokens,
                outputTokens,
                cacheReadTokens,
                cacheWriteTokens,
                cost
            })
            .onConflictDoUpdate({
                target: [
                    tokenStatsHourlyTable.hourStart,
                    tokenStatsHourlyTable.userId,
                    tokenStatsHourlyTable.agentId,
                    tokenStatsHourlyTable.model
                ],
                set: {
                    inputTokens: sql`${tokenStatsHourlyTable.inputTokens} + ${sql.raw("excluded.input_tokens")}`,
                    outputTokens: sql`${tokenStatsHourlyTable.outputTokens} + ${sql.raw("excluded.output_tokens")}`,
                    cacheReadTokens: sql`${tokenStatsHourlyTable.cacheReadTokens} + ${sql.raw("excluded.cache_read_tokens")}`,
                    cacheWriteTokens: sql`${tokenStatsHourlyTable.cacheWriteTokens} + ${sql.raw("excluded.cache_write_tokens")}`,
                    cost: sql`${tokenStatsHourlyTable.cost} + ${sql.raw("excluded.cost")}`
                }
            });
    }

    async findMany(
        ctx: Context,
        options: Omit<TokenStatsFindManyOptions, "userId"> = {}
    ): Promise<TokenStatsHourlyDbRecord[]> {
        const agentId = options.agentId ?? (ctx.hasAgentId === true ? ctx.agentId : undefined);
        return this.findAll({
            ...options,
            userId: ctx.userId,
            agentId
        });
    }

    async findAll(options: TokenStatsFindManyOptions = {}): Promise<TokenStatsHourlyDbRecord[]> {
        const conditions = [];

        const from = options.from === undefined ? undefined : hourStartResolve(options.from);
        const to = options.to === undefined ? undefined : hourStartResolve(options.to);
        const userId = options.userId?.trim();
        const agentId = options.agentId?.trim();
        const model = options.model?.trim();

        if (from !== undefined) {
            conditions.push(gte(tokenStatsHourlyTable.hourStart, from));
        }
        if (to !== undefined) {
            conditions.push(lte(tokenStatsHourlyTable.hourStart, to));
        }
        if (userId) {
            conditions.push(eq(tokenStatsHourlyTable.userId, userId));
        }
        if (agentId) {
            conditions.push(eq(tokenStatsHourlyTable.agentId, agentId));
        }
        if (model) {
            conditions.push(eq(tokenStatsHourlyTable.model, model));
        }

        const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
        const limit = numberLimitResolve(options.limit);

        const baseQuery = this.db
            .select()
            .from(tokenStatsHourlyTable)
            .where(whereClause)
            .orderBy(
                asc(tokenStatsHourlyTable.hourStart),
                asc(tokenStatsHourlyTable.userId),
                asc(tokenStatsHourlyTable.agentId),
                asc(tokenStatsHourlyTable.model)
            );

        const rows = limit !== null ? await baseQuery.limit(limit) : await baseQuery;
        return rows.map((row) => rowParse(row));
    }
}

function rowParse(row: typeof tokenStatsHourlyTable.$inferSelect): TokenStatsHourlyDbRecord {
    return {
        hourStart: numberTokenNormalize(row.hourStart),
        userId: row.userId,
        agentId: row.agentId,
        model: row.model,
        input: numberTokenNormalize(row.inputTokens),
        output: numberTokenNormalize(row.outputTokens),
        cacheRead: numberTokenNormalize(row.cacheReadTokens),
        cacheWrite: numberTokenNormalize(row.cacheWriteTokens),
        cost: numberCostNormalize(row.cost)
    };
}

function numberTokenNormalize(value: unknown): number {
    const parsed = numberParse(value);
    if (parsed === null) {
        return 0;
    }
    return Math.max(0, Math.trunc(parsed));
}

function numberCostNormalize(value: unknown): number {
    const parsed = numberParse(value);
    if (parsed === null) {
        return 0;
    }
    return Math.max(0, parsed);
}

function hourStartResolve(value: number): number {
    return Math.floor(value / HOUR_MS) * HOUR_MS;
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

function numberParse(value: unknown): number | null {
    if (typeof value === "number") {
        return Number.isFinite(value) ? value : null;
    }
    if (typeof value === "string") {
        const trimmed = value.trim();
        if (trimmed.length === 0) {
            return null;
        }
        const parsed = Number(trimmed);
        return Number.isFinite(parsed) ? parsed : null;
    }
    return null;
}
