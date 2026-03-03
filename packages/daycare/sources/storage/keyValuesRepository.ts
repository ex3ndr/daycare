import { and, asc, eq } from "drizzle-orm";
import type { Context } from "@/types";
import type { DaycareDb } from "../schema.js";
import { keyValuesTable } from "../schema.js";
import type { KeyValueDbRecord } from "./databaseTypes.js";

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

    constructor(db: DaycareDb) {
        this.db = db;
    }

    async findMany(ctx: Context): Promise<KeyValueDbRecord[]> {
        const rows = await this.db
            .select()
            .from(keyValuesTable)
            .where(eq(keyValuesTable.userId, ctx.userId))
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
            .where(and(eq(keyValuesTable.userId, ctx.userId), eq(keyValuesTable.key, normalizedKey)))
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

        const existing = await this.findByKey(ctx, key);
        if (existing) {
            throw new Error(`Key already exists: ${key}`);
        }

        const createdAt = timestampResolve(input.createdAt) ?? Date.now();
        const updatedAt = timestampResolve(input.updatedAt) ?? createdAt;

        await this.db.insert(keyValuesTable).values({
            userId: ctx.userId,
            key,
            value: structuredClone(input.value),
            createdAt,
            updatedAt
        });

        return {
            userId: ctx.userId,
            key,
            value: structuredClone(input.value),
            createdAt,
            updatedAt
        };
    }

    async update(ctx: Context, key: string, value: unknown, updatedAt?: number): Promise<KeyValueDbRecord | null> {
        const normalizedKey = keyNormalize(key);
        if (!normalizedKey) {
            throw new Error("key is required.");
        }
        if (value === undefined) {
            throw new Error("value is required.");
        }

        const existing = await this.findByKey(ctx, normalizedKey);
        if (!existing) {
            return null;
        }

        const nextUpdatedAt = timestampResolve(updatedAt) ?? Date.now();

        await this.db
            .update(keyValuesTable)
            .set({
                value: structuredClone(value),
                updatedAt: nextUpdatedAt
            })
            .where(and(eq(keyValuesTable.userId, ctx.userId), eq(keyValuesTable.key, normalizedKey)));

        return {
            userId: ctx.userId,
            key: normalizedKey,
            value: structuredClone(value),
            createdAt: existing.createdAt,
            updatedAt: nextUpdatedAt
        };
    }

    async delete(ctx: Context, key: string): Promise<boolean> {
        const normalizedKey = keyNormalize(key);
        if (!normalizedKey) {
            return false;
        }
        const existing = await this.findByKey(ctx, normalizedKey);
        if (!existing) {
            return false;
        }
        await this.db
            .delete(keyValuesTable)
            .where(and(eq(keyValuesTable.userId, ctx.userId), eq(keyValuesTable.key, normalizedKey)));
        return true;
    }
}

function keyValueParse(row: typeof keyValuesTable.$inferSelect): KeyValueDbRecord {
    return {
        userId: row.userId,
        key: row.key,
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
