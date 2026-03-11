import { and, asc, desc, eq, isNull } from "drizzle-orm";
import type { Context } from "@/types";
import type { DaycareDb } from "../schema.js";
import { miniAppsTable } from "../schema.js";
import { AsyncLock } from "../utils/lock.js";
import type { MiniAppDbRecord } from "./databaseTypes.js";
import { versionAdvance } from "./versionAdvance.js";

export type MiniAppCreateInput = {
    id: string;
    title: string;
    icon: string;
    codeVersion: number;
    createdAt: number;
    updatedAt: number;
};

export type MiniAppUpdateInput = {
    title?: string;
    icon?: string;
    codeVersion?: number;
    updatedAt?: number;
};

/**
 * Stores versioned mini-app metadata scoped to a single user/workspace.
 * Expects: schema migrations are applied and ctx carries the effective workspace user.
 */
export class MiniAppsRepository {
    private readonly db: DaycareDb;
    private readonly cache = new Map<string, MiniAppDbRecord>();
    private readonly locks = new Map<string, AsyncLock>();

    constructor(db: DaycareDb) {
        this.db = db;
    }

    async create(ctx: Context, input: MiniAppCreateInput): Promise<MiniAppDbRecord> {
        const userId = ctx.userId.trim();
        const id = input.id.trim();
        const title = input.title.trim();
        const icon = input.icon.trim();
        if (!userId) {
            throw new Error("Mini app userId is required.");
        }
        if (!id) {
            throw new Error("Mini app id is required.");
        }
        if (!title) {
            throw new Error("Mini app title is required.");
        }
        if (!icon) {
            throw new Error("Mini app icon is required.");
        }
        if (!Number.isInteger(input.codeVersion) || input.codeVersion <= 0) {
            throw new Error("Mini app codeVersion must be a positive integer.");
        }

        const key = miniAppKey(userId, id);
        return this.lockFor(key).inLock(async () => {
            const existing = this.cache.get(key) ?? (await this.findAnyById(ctx, id));
            if (existing) {
                throw new Error(`Mini app id already exists: ${id}`);
            }

            const record: MiniAppDbRecord = {
                userId,
                id,
                version: 1,
                codeVersion: input.codeVersion,
                validFrom: input.createdAt,
                validTo: null,
                title,
                icon,
                createdAt: input.createdAt,
                updatedAt: input.updatedAt
            };
            await this.db.insert(miniAppsTable).values(miniAppRowInsert(record));
            this.cache.set(key, miniAppClone(record));
            return miniAppClone(record);
        });
    }

    async update(ctx: Context, id: string, input: MiniAppUpdateInput): Promise<MiniAppDbRecord> {
        const userId = ctx.userId.trim();
        const normalizedId = id.trim();
        if (!userId) {
            throw new Error("Mini app userId is required.");
        }
        if (!normalizedId) {
            throw new Error("Mini app id is required.");
        }
        if (input.codeVersion !== undefined && (!Number.isInteger(input.codeVersion) || input.codeVersion <= 0)) {
            throw new Error("Mini app codeVersion must be a positive integer.");
        }

        const key = miniAppKey(userId, normalizedId);
        return this.lockFor(key).inLock(async () => {
            const current = this.cache.get(key) ?? (await this.findById(ctx, normalizedId));
            if (!current) {
                throw new Error(`Mini app not found: ${normalizedId}`);
            }
            const now = input.updatedAt ?? Date.now();
            const title = input.title?.trim();
            const icon = input.icon?.trim();
            const advanced = await this.db.transaction(async (tx) =>
                versionAdvance<MiniAppDbRecord>({
                    now,
                    changes: {
                        title: title && title.length > 0 ? title : current.title,
                        icon: icon && icon.length > 0 ? icon : current.icon,
                        codeVersion: input.codeVersion ?? current.codeVersion,
                        createdAt: current.createdAt,
                        updatedAt: now
                    },
                    findCurrent: async () => current,
                    closeCurrent: async (row, closedAt) => {
                        const closedRows = await tx
                            .update(miniAppsTable)
                            .set({ validTo: closedAt })
                            .where(
                                and(
                                    eq(miniAppsTable.userId, row.userId),
                                    eq(miniAppsTable.id, row.id),
                                    eq(miniAppsTable.version, row.version ?? 1),
                                    isNull(miniAppsTable.validTo)
                                )
                            )
                            .returning({ version: miniAppsTable.version });
                        return closedRows.length;
                    },
                    insertNext: async (row) => {
                        await tx.insert(miniAppsTable).values(miniAppRowInsert(row));
                    }
                })
            );
            this.cache.set(key, miniAppClone(advanced));
            return miniAppClone(advanced);
        });
    }

    async delete(ctx: Context, id: string): Promise<MiniAppDbRecord> {
        const userId = ctx.userId.trim();
        const normalizedId = id.trim();
        if (!userId) {
            throw new Error("Mini app userId is required.");
        }
        if (!normalizedId) {
            throw new Error("Mini app id is required.");
        }

        const key = miniAppKey(userId, normalizedId);
        return this.lockFor(key).inLock(async () => {
            const current = this.cache.get(key) ?? (await this.findById(ctx, normalizedId));
            if (!current) {
                throw new Error(`Mini app not found: ${normalizedId}`);
            }
            await this.db
                .update(miniAppsTable)
                .set({ validTo: Date.now() })
                .where(
                    and(
                        eq(miniAppsTable.userId, userId),
                        eq(miniAppsTable.id, normalizedId),
                        eq(miniAppsTable.version, current.version ?? 1),
                        isNull(miniAppsTable.validTo)
                    )
                );
            this.cache.delete(key);
            return miniAppClone(current);
        });
    }

    async restore(ctx: Context, id: string): Promise<MiniAppDbRecord> {
        const userId = ctx.userId.trim();
        const normalizedId = id.trim();
        if (!userId) {
            throw new Error("Mini app userId is required.");
        }
        if (!normalizedId) {
            throw new Error("Mini app id is required.");
        }

        const key = miniAppKey(userId, normalizedId);
        return this.lockFor(key).inLock(async () => {
            const current = await this.findAnyById(ctx, normalizedId);
            if (!current) {
                throw new Error(`Mini app not found: ${normalizedId}`);
            }
            if (current.validTo === null) {
                throw new Error(`Mini app is not deleted: ${normalizedId}`);
            }

            const now = Date.now();
            const advanced = await this.db.transaction(async (tx) =>
                versionAdvance<MiniAppDbRecord>({
                    now,
                    changes: {},
                    findCurrent: () => Promise.resolve(current),
                    closeCurrent: async () => 1,
                    insertNext: async (next) => {
                        await tx.insert(miniAppsTable).values(miniAppRowInsert(next));
                    }
                })
            );
            this.cache.set(key, miniAppClone(advanced));
            return miniAppClone(advanced);
        });
    }

    async findById(ctx: Context, id: string): Promise<MiniAppDbRecord | null> {
        const userId = ctx.userId.trim();
        const normalizedId = id.trim();
        if (!userId || !normalizedId) {
            return null;
        }

        const key = miniAppKey(userId, normalizedId);
        const cached = this.cache.get(key);
        if (cached) {
            return miniAppClone(cached);
        }

        const rows = await this.db
            .select()
            .from(miniAppsTable)
            .where(
                and(eq(miniAppsTable.userId, userId), eq(miniAppsTable.id, normalizedId), isNull(miniAppsTable.validTo))
            )
            .limit(1);
        const row = rows[0];
        if (!row) {
            return null;
        }
        const parsed = miniAppParse(row);
        this.cache.set(key, miniAppClone(parsed));
        return miniAppClone(parsed);
    }

    async findByVersion(ctx: Context, id: string, version: number): Promise<MiniAppDbRecord | null> {
        const userId = ctx.userId.trim();
        const normalizedId = id.trim();
        const normalizedVersion = Math.trunc(version);
        if (!userId || !normalizedId || normalizedVersion <= 0) {
            return null;
        }

        const cached = this.cache.get(miniAppKey(userId, normalizedId));
        if (cached && (cached.version ?? 1) === normalizedVersion) {
            return miniAppClone(cached);
        }

        const rows = await this.db
            .select()
            .from(miniAppsTable)
            .where(
                and(
                    eq(miniAppsTable.userId, userId),
                    eq(miniAppsTable.id, normalizedId),
                    eq(miniAppsTable.version, normalizedVersion)
                )
            )
            .limit(1);
        const row = rows[0];
        return row ? miniAppParse(row) : null;
    }

    async findAnyById(ctx: Context, id: string): Promise<MiniAppDbRecord | null> {
        const userId = ctx.userId.trim();
        const normalizedId = id.trim();
        if (!userId || !normalizedId) {
            return null;
        }

        const rows = await this.db
            .select()
            .from(miniAppsTable)
            .where(and(eq(miniAppsTable.userId, userId), eq(miniAppsTable.id, normalizedId)))
            .orderBy(desc(miniAppsTable.version))
            .limit(1);
        const row = rows[0];
        return row ? miniAppParse(row) : null;
    }

    async findAll(ctx: Context): Promise<MiniAppDbRecord[]> {
        const userId = ctx.userId.trim();
        if (!userId) {
            return [];
        }

        const rows = await this.db
            .select()
            .from(miniAppsTable)
            .where(and(eq(miniAppsTable.userId, userId), isNull(miniAppsTable.validTo)))
            .orderBy(asc(miniAppsTable.updatedAt), asc(miniAppsTable.id));
        const parsed = rows.map((row) => miniAppParse(row));
        for (const record of parsed) {
            this.cache.set(miniAppKey(record.userId, record.id), miniAppClone(record));
        }
        return parsed.map((record) => miniAppClone(record));
    }

    private lockFor(key: string): AsyncLock {
        const existing = this.locks.get(key);
        if (existing) {
            return existing;
        }
        const created = new AsyncLock();
        this.locks.set(key, created);
        return created;
    }
}

function miniAppKey(userId: string, id: string): string {
    return `${userId}\u0000${id}`;
}

function miniAppParse(row: typeof miniAppsTable.$inferSelect): MiniAppDbRecord {
    return {
        userId: row.userId,
        id: row.id,
        version: row.version,
        codeVersion: row.codeVersion,
        validFrom: row.validFrom,
        validTo: row.validTo,
        title: row.title,
        icon: row.icon,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt
    };
}

function miniAppClone(record: MiniAppDbRecord): MiniAppDbRecord {
    return {
        ...record
    };
}

function miniAppRowInsert(record: MiniAppDbRecord): typeof miniAppsTable.$inferInsert {
    return {
        userId: record.userId,
        id: record.id,
        version: record.version ?? 1,
        codeVersion: record.codeVersion,
        validFrom: record.validFrom ?? record.createdAt,
        validTo: record.validTo ?? null,
        title: record.title,
        icon: record.icon,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt
    };
}