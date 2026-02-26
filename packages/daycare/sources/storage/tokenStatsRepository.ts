import type { StorageDatabase as DatabaseSync } from "./databaseOpen.js";
import type { Context } from "@/types";
import type { SQLInputValue } from "node:sqlite";
import type { DatabaseTokenStatsHourlyRow, TokenStatsHourlyDbRecord } from "./databaseTypes.js";

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
    private readonly db: DatabaseSync;

    constructor(db: DatabaseSync) {
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

        this.db
            .prepare(
                `
                INSERT INTO token_stats_hourly (
                    hour_start,
                    user_id,
                    agent_id,
                    model,
                    input_tokens,
                    output_tokens,
                    cache_read_tokens,
                    cache_write_tokens,
                    cost
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(hour_start, user_id, agent_id, model) DO UPDATE SET
                    input_tokens = input_tokens + excluded.input_tokens,
                    output_tokens = output_tokens + excluded.output_tokens,
                    cache_read_tokens = cache_read_tokens + excluded.cache_read_tokens,
                    cache_write_tokens = cache_write_tokens + excluded.cache_write_tokens,
                    cost = cost + excluded.cost
            `
            )
            .run(
                hourStart,
                ctx.userId,
                ctx.agentId,
                model,
                inputTokens,
                outputTokens,
                cacheReadTokens,
                cacheWriteTokens,
                cost
            );
    }

    async findMany(
        ctx: Context,
        options: Omit<TokenStatsFindManyOptions, "userId"> = {}
    ): Promise<TokenStatsHourlyDbRecord[]> {
        return this.findAll({
            ...options,
            userId: ctx.userId,
            agentId: options.agentId ?? ctx.agentId
        });
    }

    async findAll(options: TokenStatsFindManyOptions = {}): Promise<TokenStatsHourlyDbRecord[]> {
        const where: string[] = [];
        const values: SQLInputValue[] = [];

        const from = options.from === undefined ? undefined : hourStartResolve(options.from);
        const to = options.to === undefined ? undefined : hourStartResolve(options.to);
        const userId = options.userId?.trim();
        const agentId = options.agentId?.trim();
        const model = options.model?.trim();

        if (from !== undefined) {
            where.push("hour_start >= ?");
            values.push(from);
        }
        if (to !== undefined) {
            where.push("hour_start <= ?");
            values.push(to);
        }
        if (userId) {
            where.push("user_id = ?");
            values.push(userId);
        }
        if (agentId) {
            where.push("agent_id = ?");
            values.push(agentId);
        }
        if (model) {
            where.push("model = ?");
            values.push(model);
        }

        let sql = "SELECT * FROM token_stats_hourly";
        if (where.length > 0) {
            sql += ` WHERE ${where.join(" AND ")}`;
        }
        sql += " ORDER BY hour_start ASC, user_id ASC, agent_id ASC, model ASC";

        const limit = numberLimitResolve(options.limit);
        if (limit !== null) {
            sql += " LIMIT ?";
            values.push(limit);
        }

        const rows = this.db.prepare(sql).all(...values) as DatabaseTokenStatsHourlyRow[];
        return rows.map((row) => rowParse(row));
    }
}

function rowParse(row: DatabaseTokenStatsHourlyRow): TokenStatsHourlyDbRecord {
    return {
        hourStart: numberTokenNormalize(row.hour_start),
        userId: row.user_id,
        agentId: row.agent_id,
        model: row.model,
        input: numberTokenNormalize(row.input_tokens),
        output: numberTokenNormalize(row.output_tokens),
        cacheRead: numberTokenNormalize(row.cache_read_tokens),
        cacheWrite: numberTokenNormalize(row.cache_write_tokens),
        cost: numberCostNormalize(row.cost)
    };
}

function numberTokenNormalize(value: unknown): number {
    if (typeof value !== "number" || !Number.isFinite(value)) {
        return 0;
    }
    return Math.max(0, Math.trunc(value));
}

function numberCostNormalize(value: unknown): number {
    if (typeof value !== "number" || !Number.isFinite(value)) {
        return 0;
    }
    return Math.max(0, value);
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
