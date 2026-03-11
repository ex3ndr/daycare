import { and, asc, desc, eq, isNull } from "drizzle-orm";
import type { Context } from "@/types";
import type { DaycareDb } from "../schema.js";
import { fragmentsTable } from "../schema.js";
import { AsyncLock } from "../utils/lock.js";
import type { FragmentDbRecord } from "./databaseTypes.js";
import { versionAdvance } from "./versionAdvance.js";

export type FragmentCreateInput = {
    id: string;
    kitVersion: string;
    title: string;
    description?: string;
    spec: unknown;
    createdAt: number;
    updatedAt: number;
};

export type FragmentUpdateInput = {
    kitVersion?: string;
    title?: string;
    description?: string;
    spec?: unknown;
    updatedAt?: number;
};

/**
 * Versioned fragments repository with write-through cache and per-fragment locking.
 * Expects: schema migrations already applied for fragments.
 */
export class FragmentsRepository {
    private readonly db: DaycareDb;
    private readonly fragmentsById = new Map<string, FragmentDbRecord>();
    private readonly fragmentLocks = new Map<string, AsyncLock>();
    private readonly cacheLock = new AsyncLock();

    constructor(db: DaycareDb) {
        this.db = db;
    }

    async create(ctx: Context, input: FragmentCreateInput): Promise<FragmentDbRecord> {
        const userId = ctx.userId.trim();
        if (!userId) {
            throw new Error("Fragment userId is required.");
        }

        const normalized = fragmentCreateNormalize(input);
        const key = fragmentKey(userId, normalized.id);
        const lock = this.fragmentLockForId(key);
        return lock.inLock(async () => {
            const existing = this.fragmentsById.get(key) ?? (await this.fragmentLoadAnyById(userId, normalized.id));
            if (existing) {
                throw new Error(`Fragment id already exists: ${normalized.id}`);
            }

            const next: FragmentDbRecord = {
                id: normalized.id,
                userId,
                version: 1,
                validFrom: normalized.createdAt,
                validTo: null,
                kitVersion: normalized.kitVersion,
                title: normalized.title,
                description: normalized.description,
                spec: normalized.spec,
                archived: false,
                createdAt: normalized.createdAt,
                updatedAt: normalized.updatedAt
            };

            await this.db.insert(fragmentsTable).values(fragmentRowInsert(next));
            await this.cacheLock.inLock(() => {
                this.fragmentCacheSet(next);
            });
            return fragmentClone(next);
        });
    }

    async update(ctx: Context, id: string, input: FragmentUpdateInput): Promise<FragmentDbRecord> {
        const userId = ctx.userId.trim();
        if (!userId) {
            throw new Error("Fragment userId is required.");
        }
        const normalizedId = id.trim();
        if (!normalizedId) {
            throw new Error("Fragment id is required.");
        }
        const key = fragmentKey(userId, normalizedId);
        const lock = this.fragmentLockForId(key);
        return lock.inLock(async () => {
            const current = this.fragmentsById.get(key) ?? (await this.fragmentLoadById(userId, normalizedId));
            if (!current) {
                throw new Error(`Fragment not found: ${normalizedId}`);
            }

            const now = input.updatedAt ?? Date.now();
            const normalized = fragmentUpdateNormalize(input);
            const advanced = await this.db.transaction(async (tx) =>
                versionAdvance<FragmentDbRecord>({
                    now,
                    changes: {
                        kitVersion: normalized.kitVersion ?? current.kitVersion,
                        title: normalized.title ?? current.title,
                        description: normalized.description ?? current.description,
                        spec: normalized.spec === undefined ? current.spec : normalized.spec,
                        archived: current.archived,
                        createdAt: current.createdAt,
                        updatedAt: now
                    },
                    findCurrent: async () => current,
                    closeCurrent: async (row, closedAt) => {
                        const closedRows = await tx
                            .update(fragmentsTable)
                            .set({ validTo: closedAt })
                            .where(
                                and(
                                    eq(fragmentsTable.userId, row.userId),
                                    eq(fragmentsTable.id, row.id),
                                    eq(fragmentsTable.version, row.version ?? 1),
                                    isNull(fragmentsTable.validTo)
                                )
                            )
                            .returning({ version: fragmentsTable.version });
                        return closedRows.length;
                    },
                    insertNext: async (row) => {
                        await tx.insert(fragmentsTable).values(fragmentRowInsert(row));
                    }
                })
            );

            await this.cacheLock.inLock(() => {
                this.fragmentCacheSet(advanced);
            });
            return fragmentClone(advanced);
        });
    }

    async archive(ctx: Context, id: string): Promise<FragmentDbRecord> {
        const userId = ctx.userId.trim();
        if (!userId) {
            throw new Error("Fragment userId is required.");
        }
        const normalizedId = id.trim();
        if (!normalizedId) {
            throw new Error("Fragment id is required.");
        }
        const key = fragmentKey(userId, normalizedId);
        const lock = this.fragmentLockForId(key);
        return lock.inLock(async () => {
            const current = this.fragmentsById.get(key) ?? (await this.fragmentLoadById(userId, normalizedId));
            if (!current) {
                throw new Error(`Fragment not found: ${normalizedId}`);
            }

            const now = Date.now();
            const advanced = await this.db.transaction(async (tx) =>
                versionAdvance<FragmentDbRecord>({
                    now,
                    changes: {
                        archived: true,
                        createdAt: current.createdAt,
                        updatedAt: now
                    },
                    findCurrent: async () => current,
                    closeCurrent: async (row, closedAt) => {
                        const closedRows = await tx
                            .update(fragmentsTable)
                            .set({ validTo: closedAt })
                            .where(
                                and(
                                    eq(fragmentsTable.userId, row.userId),
                                    eq(fragmentsTable.id, row.id),
                                    eq(fragmentsTable.version, row.version ?? 1),
                                    isNull(fragmentsTable.validTo)
                                )
                            )
                            .returning({ version: fragmentsTable.version });
                        return closedRows.length;
                    },
                    insertNext: async (row) => {
                        await tx.insert(fragmentsTable).values(fragmentRowInsert(row));
                    }
                })
            );

            await this.cacheLock.inLock(() => {
                this.fragmentsById.delete(key);
            });
            return fragmentClone(advanced);
        });
    }

    async unarchive(ctx: Context, id: string): Promise<FragmentDbRecord> {
        const userId = ctx.userId.trim();
        if (!userId) {
            throw new Error("Fragment userId is required.");
        }
        const normalizedId = id.trim();
        if (!normalizedId) {
            throw new Error("Fragment id is required.");
        }
        const key = fragmentKey(userId, normalizedId);
        const lock = this.fragmentLockForId(key);
        return lock.inLock(async () => {
            const current = await this.fragmentLoadAnyById(userId, normalizedId);
            if (!current) {
                throw new Error(`Fragment not found: ${normalizedId}`);
            }
            if (!current.archived) {
                throw new Error(`Fragment is not archived: ${normalizedId}`);
            }

            const now = Date.now();
            const advanced = await this.db.transaction(async (tx) =>
                versionAdvance<FragmentDbRecord>({
                    now,
                    changes: {
                        archived: false,
                        updatedAt: now
                    },
                    findCurrent: () => Promise.resolve(current),
                    closeCurrent: async (current, closeTime) => {
                        const result = await tx
                            .update(fragmentsTable)
                            .set({ validTo: closeTime })
                            .where(
                                and(
                                    eq(fragmentsTable.userId, userId),
                                    eq(fragmentsTable.id, normalizedId),
                                    eq(fragmentsTable.version, current.version ?? 1),
                                    isNull(fragmentsTable.validTo)
                                )
                            );
                        return result.rowsAffected;
                    },
                    insertNext: async (next) => {
                        await tx.insert(fragmentsTable).values(fragmentRowInsert(next));
                    }
                })
            );

            await this.cacheLock.inLock(() => {
                this.fragmentCacheSet(advanced);
            });
            return fragmentClone(advanced);
        });
    }

    async findById(ctx: Context, id: string): Promise<FragmentDbRecord | null> {
        const userId = ctx.userId.trim();
        if (!userId) {
            return null;
        }
        const normalizedId = id.trim();
        if (!normalizedId) {
            return null;
        }
        const key = fragmentKey(userId, normalizedId);
        const cached = this.fragmentsById.get(key);
        if (cached) {
            return fragmentClone(cached);
        }

        const lock = this.fragmentLockForId(key);
        return lock.inLock(async () => {
            const existing = this.fragmentsById.get(key);
            if (existing) {
                return fragmentClone(existing);
            }
            const loaded = await this.fragmentLoadById(userId, normalizedId);
            if (!loaded) {
                return null;
            }
            await this.cacheLock.inLock(() => {
                this.fragmentCacheSet(loaded);
            });
            return fragmentClone(loaded);
        });
    }

    async findAll(ctx: Context): Promise<FragmentDbRecord[]> {
        const userId = ctx.userId.trim();
        if (!userId) {
            return [];
        }

        const rows = await this.db
            .select()
            .from(fragmentsTable)
            .where(
                and(
                    eq(fragmentsTable.userId, userId),
                    isNull(fragmentsTable.validTo),
                    eq(fragmentsTable.archived, false)
                )
            )
            .orderBy(asc(fragmentsTable.updatedAt), asc(fragmentsTable.id));

        const parsed = rows.map((row) => fragmentParse(row));
        await this.cacheLock.inLock(() => {
            for (const record of parsed) {
                this.fragmentCacheSet(record);
            }
        });
        return parsed.map((record) => fragmentClone(record));
    }

    async findAnyById(ctx: Context, id: string): Promise<FragmentDbRecord | null> {
        const userId = ctx.userId.trim();
        if (!userId) {
            return null;
        }
        const normalizedId = id.trim();
        if (!normalizedId) {
            return null;
        }

        const key = fragmentKey(userId, normalizedId);
        const cached = this.fragmentsById.get(key);
        if (cached) {
            return fragmentClone(cached);
        }

        const lock = this.fragmentLockForId(key);
        return lock.inLock(async () => {
            const existing = this.fragmentsById.get(key);
            if (existing) {
                return fragmentClone(existing);
            }
            const loaded = await this.fragmentLoadAnyById(userId, normalizedId);
            if (!loaded) {
                return null;
            }
            if (!loaded.archived && loaded.validTo == null) {
                await this.cacheLock.inLock(() => {
                    this.fragmentCacheSet(loaded);
                });
            }
            return fragmentClone(loaded);
        });
    }

    private fragmentCacheSet(record: FragmentDbRecord): void {
        if (record.archived || record.validTo !== null) {
            this.fragmentsById.delete(fragmentKey(record.userId, record.id));
            return;
        }
        this.fragmentsById.set(fragmentKey(record.userId, record.id), fragmentClone(record));
    }

    private async fragmentLoadById(userId: string, id: string): Promise<FragmentDbRecord | null> {
        const rows = await this.db
            .select()
            .from(fragmentsTable)
            .where(
                and(
                    eq(fragmentsTable.userId, userId),
                    eq(fragmentsTable.id, id),
                    isNull(fragmentsTable.validTo),
                    eq(fragmentsTable.archived, false)
                )
            )
            .limit(1);
        const row = rows[0];
        if (!row) {
            return null;
        }
        return fragmentParse(row);
    }

    private async fragmentLoadAnyById(userId: string, id: string): Promise<FragmentDbRecord | null> {
        const rows = await this.db
            .select()
            .from(fragmentsTable)
            .where(and(eq(fragmentsTable.userId, userId), eq(fragmentsTable.id, id)))
            .orderBy(desc(fragmentsTable.version))
            .limit(1);
        const row = rows[0];
        if (!row) {
            return null;
        }
        return fragmentParse(row);
    }

    private fragmentLockForId(fragmentId: string): AsyncLock {
        const existing = this.fragmentLocks.get(fragmentId);
        if (existing) {
            return existing;
        }
        const lock = new AsyncLock();
        this.fragmentLocks.set(fragmentId, lock);
        return lock;
    }
}

function fragmentParse(row: typeof fragmentsTable.$inferSelect): FragmentDbRecord {
    return {
        id: row.id,
        userId: row.userId,
        version: row.version ?? 1,
        validFrom: row.validFrom ?? row.createdAt,
        validTo: row.validTo ?? null,
        kitVersion: row.kitVersion,
        title: row.title,
        description: row.description,
        spec: jsonValueParse(row.spec),
        archived: row.archived,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt
    };
}

function fragmentClone(record: FragmentDbRecord): FragmentDbRecord {
    return {
        ...record,
        spec: jsonValueParse(record.spec)
    };
}

function fragmentRowInsert(record: FragmentDbRecord): typeof fragmentsTable.$inferInsert {
    return {
        id: record.id,
        userId: record.userId,
        version: record.version ?? 1,
        validFrom: record.validFrom ?? record.createdAt,
        validTo: record.validTo ?? null,
        kitVersion: record.kitVersion,
        title: record.title,
        description: record.description,
        spec: record.spec,
        archived: record.archived,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt
    };
}

function fragmentCreateNormalize(input: FragmentCreateInput): FragmentCreateInput & { description: string } {
    const id = input.id.trim();
    if (!id) {
        throw new Error("Fragment id is required.");
    }
    const kitVersion = input.kitVersion.trim();
    if (!kitVersion) {
        throw new Error("Fragment kitVersion is required.");
    }
    const title = input.title.trim();
    if (!title) {
        throw new Error("Fragment title is required.");
    }
    return {
        ...input,
        id,
        kitVersion,
        title,
        description: input.description?.trim() ?? ""
    };
}

function fragmentUpdateNormalize(input: FragmentUpdateInput): FragmentUpdateInput {
    const normalized: FragmentUpdateInput = {};
    if (input.kitVersion !== undefined) {
        const kitVersion = input.kitVersion.trim();
        if (!kitVersion) {
            throw new Error("Fragment kitVersion is required.");
        }
        normalized.kitVersion = kitVersion;
    }
    if (input.title !== undefined) {
        const title = input.title.trim();
        if (!title) {
            throw new Error("Fragment title is required.");
        }
        normalized.title = title;
    }
    if (input.description !== undefined) {
        normalized.description = input.description.trim();
    }
    if (Object.hasOwn(input, "spec")) {
        normalized.spec = input.spec;
    }
    if (input.updatedAt !== undefined) {
        normalized.updatedAt = input.updatedAt;
    }
    return normalized;
}

function fragmentKey(userId: string, id: string): string {
    return `${userId}\u0000${id}`;
}

function jsonValueParse(value: unknown): unknown {
    if (typeof value === "string") {
        return JSON.parse(value);
    }
    return structuredClone(value);
}