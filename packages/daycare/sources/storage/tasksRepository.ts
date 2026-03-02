import { and, asc, desc, eq, isNull } from "drizzle-orm";
import type { Context } from "@/types";
import type { DaycareDb } from "../schema.js";
import { tasksTable } from "../schema.js";
import { AsyncLock } from "../utils/lock.js";
import type { TaskDbRecord } from "./databaseTypes.js";
import { versionAdvance } from "./versionAdvance.js";

/**
 * Unified tasks repository backed by Drizzle with write-through caching.
 * Expects: schema migrations already applied for tasks.
 */
export class TasksRepository {
    private readonly db: DaycareDb;
    private readonly tasksById = new Map<string, TaskDbRecord>();
    private readonly taskLocks = new Map<string, AsyncLock>();
    private readonly cacheLock = new AsyncLock();
    private readonly createLock = new AsyncLock();

    constructor(db: DaycareDb) {
        this.db = db;
    }

    async findById(ctx: Context, id: string): Promise<TaskDbRecord | null> {
        const userId = ctx.userId.trim();
        if (!userId) {
            return null;
        }
        const key = taskKey(userId, id);
        const cached = this.tasksById.get(key);
        if (cached) {
            return taskClone(cached);
        }

        const lock = this.taskLockForId(key);
        return lock.inLock(async () => {
            const existing = this.tasksById.get(key);
            if (existing) {
                return taskClone(existing);
            }
            const loaded = await this.taskLoadById(userId, id);
            if (!loaded) {
                return null;
            }
            await this.cacheLock.inLock(() => {
                this.taskCacheSet(loaded);
            });
            return taskClone(loaded);
        });
    }

    async findAnyById(ctx: Context, id: string): Promise<TaskDbRecord | null> {
        const userId = ctx.userId.trim();
        if (!userId) {
            return null;
        }
        const key = taskKey(userId, id);
        const cached = this.tasksById.get(key);
        if (cached) {
            return taskClone(cached);
        }

        const lock = this.taskLockForId(key);
        return lock.inLock(async () => {
            const existing = this.tasksById.get(key);
            if (existing) {
                return taskClone(existing);
            }
            const loaded = await this.taskLoadAnyById(userId, id);
            if (!loaded) {
                return null;
            }
            if (loaded.validTo == null) {
                await this.cacheLock.inLock(() => {
                    this.taskCacheSet(loaded);
                });
            }
            return taskClone(loaded);
        });
    }

    /**
     * Finds a specific historical or active task version for a user.
     * Returns null when the requested version does not exist.
     */
    async findByVersion(ctx: Context, id: string, version: number): Promise<TaskDbRecord | null> {
        const userId = ctx.userId.trim();
        if (!userId) {
            return null;
        }
        const normalizedVersion = Math.trunc(version);
        if (!Number.isFinite(normalizedVersion) || normalizedVersion <= 0) {
            return null;
        }
        const loaded = await this.taskLoadByVersion(userId, id, normalizedVersion);
        if (!loaded) {
            return null;
        }
        if (loaded.validTo == null) {
            await this.cacheLock.inLock(() => {
                this.taskCacheSet(loaded);
            });
        }
        return taskClone(loaded);
    }

    async findMany(ctx: Context): Promise<TaskDbRecord[]> {
        const rows = await this.db
            .select()
            .from(tasksTable)
            .where(and(eq(tasksTable.userId, ctx.userId), isNull(tasksTable.validTo)))
            .orderBy(asc(tasksTable.updatedAt));
        return rows.map((row) => taskClone(taskParse(row)));
    }

    async findAll(): Promise<TaskDbRecord[]> {
        const rows = await this.db
            .select()
            .from(tasksTable)
            .where(isNull(tasksTable.validTo))
            .orderBy(asc(tasksTable.updatedAt));
        const parsed = rows.map((row) => taskParse(row));

        await this.cacheLock.inLock(() => {
            for (const task of parsed) {
                this.taskCacheSet(task);
            }
        });

        return parsed.map((task) => taskClone(task));
    }

    async create(record: TaskDbRecord): Promise<void> {
        await this.createLock.inLock(async () => {
            const userId = record.userId.trim();
            if (!userId) {
                throw new Error("Task userId is required.");
            }
            const current = await this.taskLoadById(userId, record.id);
            if (!current && (await this.taskLoadAnyById(userId, record.id))) {
                throw new Error(`Task id is reserved by historical task versions: ${record.id}`);
            }
            let next: TaskDbRecord;
            if (!current) {
                next = {
                    ...record,
                    userId,
                    version: 1,
                    validFrom: record.createdAt,
                    validTo: null
                };
                await this.db.insert(tasksTable).values({
                    id: next.id,
                    userId: next.userId,
                    version: next.version ?? 1,
                    validFrom: next.validFrom ?? next.createdAt,
                    validTo: next.validTo ?? null,
                    title: next.title,
                    description: next.description,
                    code: next.code,
                    parameters: next.parameters,
                    createdAt: next.createdAt,
                    updatedAt: next.updatedAt
                });
            } else {
                next = await this.db.transaction(async (tx) =>
                    versionAdvance<TaskDbRecord>({
                        changes: {
                            userId,
                            title: record.title,
                            description: record.description,
                            code: record.code,
                            parameters: record.parameters,
                            createdAt: record.createdAt,
                            updatedAt: record.updatedAt
                        },
                        findCurrent: async () => current,
                        closeCurrent: async (row, now) => {
                            const closedRows = await tx
                                .update(tasksTable)
                                .set({ validTo: now })
                                .where(
                                    and(
                                        eq(tasksTable.userId, row.userId),
                                        eq(tasksTable.id, row.id),
                                        eq(tasksTable.version, row.version ?? 1),
                                        isNull(tasksTable.validTo)
                                    )
                                )
                                .returning({ version: tasksTable.version });
                            return closedRows.length;
                        },
                        insertNext: async (row) => {
                            await tx.insert(tasksTable).values({
                                id: row.id,
                                userId: row.userId,
                                version: row.version ?? 1,
                                validFrom: row.validFrom ?? row.createdAt,
                                validTo: row.validTo ?? null,
                                title: row.title,
                                description: row.description,
                                code: row.code,
                                parameters: row.parameters,
                                createdAt: row.createdAt,
                                updatedAt: row.updatedAt
                            });
                        }
                    })
                );
            }

            await this.cacheLock.inLock(() => {
                this.taskCacheSet(next);
            });
        });
    }

    async update(ctx: Context, id: string, data: Partial<TaskDbRecord>): Promise<void> {
        const userId = ctx.userId.trim();
        if (!userId) {
            throw new Error("Task userId is required.");
        }
        const key = taskKey(userId, id);
        const lock = this.taskLockForId(key);
        await lock.inLock(async () => {
            const current = this.tasksById.get(key) ?? (await this.taskLoadById(userId, id));
            if (!current) {
                throw new Error(`Task not found: ${id}`);
            }

            const next: TaskDbRecord = {
                ...current,
                ...data,
                id: current.id,
                userId: data.userId?.trim() || current.userId,
                description: data.description === undefined ? current.description : data.description,
                parameters: data.parameters === undefined ? current.parameters : data.parameters
            };

            const advanced = await this.db.transaction(async (tx) =>
                versionAdvance<TaskDbRecord>({
                    changes: {
                        userId: next.userId,
                        title: next.title,
                        description: next.description,
                        code: next.code,
                        parameters: next.parameters,
                        createdAt: next.createdAt,
                        updatedAt: next.updatedAt
                    },
                    findCurrent: async () => current,
                    closeCurrent: async (row, now) => {
                        const closedRows = await tx
                            .update(tasksTable)
                            .set({ validTo: now })
                            .where(
                                and(
                                    eq(tasksTable.userId, row.userId),
                                    eq(tasksTable.id, row.id),
                                    eq(tasksTable.version, row.version ?? 1),
                                    isNull(tasksTable.validTo)
                                )
                            )
                            .returning({ version: tasksTable.version });
                        return closedRows.length;
                    },
                    insertNext: async (row) => {
                        await tx.insert(tasksTable).values({
                            id: row.id,
                            userId: row.userId,
                            version: row.version ?? 1,
                            validFrom: row.validFrom ?? row.createdAt,
                            validTo: row.validTo ?? null,
                            title: row.title,
                            description: row.description,
                            code: row.code,
                            parameters: row.parameters,
                            createdAt: row.createdAt,
                            updatedAt: row.updatedAt
                        });
                    }
                })
            );

            await this.cacheLock.inLock(() => {
                this.taskCacheSet(advanced);
            });
        });
    }

    async delete(ctx: Context, id: string): Promise<boolean> {
        const userId = ctx.userId.trim();
        if (!userId) {
            return false;
        }
        const key = taskKey(userId, id);
        const lock = this.taskLockForId(key);
        return lock.inLock(async () => {
            const current = this.tasksById.get(key) ?? (await this.taskLoadById(userId, id));
            if (!current) {
                return false;
            }
            const now = Date.now();
            await this.db
                .update(tasksTable)
                .set({ validTo: now })
                .where(
                    and(
                        eq(tasksTable.userId, current.userId),
                        eq(tasksTable.id, current.id),
                        eq(tasksTable.version, current.version ?? 1),
                        isNull(tasksTable.validTo)
                    )
                );
            await this.cacheLock.inLock(() => {
                this.tasksById.delete(key);
            });
            return true;
        });
    }

    private taskCacheSet(record: TaskDbRecord): void {
        this.tasksById.set(taskKey(record.userId, record.id), taskClone(record));
    }

    private async taskLoadById(userId: string, id: string): Promise<TaskDbRecord | null> {
        const rows = await this.db
            .select()
            .from(tasksTable)
            .where(and(eq(tasksTable.userId, userId), eq(tasksTable.id, id), isNull(tasksTable.validTo)))
            .limit(1);
        const row = rows[0];
        if (!row) {
            return null;
        }
        return taskParse(row);
    }

    private async taskLoadAnyById(userId: string, id: string): Promise<TaskDbRecord | null> {
        const rows = await this.db
            .select()
            .from(tasksTable)
            .where(and(eq(tasksTable.userId, userId), eq(tasksTable.id, id)))
            .orderBy(desc(tasksTable.version))
            .limit(1);
        const row = rows[0];
        if (!row) {
            return null;
        }
        return taskParse(row);
    }

    private async taskLoadByVersion(userId: string, id: string, version: number): Promise<TaskDbRecord | null> {
        const rows = await this.db
            .select()
            .from(tasksTable)
            .where(and(eq(tasksTable.userId, userId), eq(tasksTable.id, id), eq(tasksTable.version, version)))
            .limit(1);
        const row = rows[0];
        if (!row) {
            return null;
        }
        return taskParse(row);
    }

    private taskLockForId(taskId: string): AsyncLock {
        const existing = this.taskLocks.get(taskId);
        if (existing) {
            return existing;
        }
        const lock = new AsyncLock();
        this.taskLocks.set(taskId, lock);
        return lock;
    }
}

function taskParse(row: typeof tasksTable.$inferSelect): TaskDbRecord {
    return {
        id: row.id,
        userId: row.userId,
        version: row.version ?? 1,
        validFrom: row.validFrom ?? row.createdAt,
        validTo: row.validTo ?? null,
        title: row.title,
        description: row.description,
        code: row.code,
        parameters: row.parameters ? (jsonValueParse(row.parameters) as TaskDbRecord["parameters"]) : null,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt
    };
}

function taskClone(record: TaskDbRecord): TaskDbRecord {
    return { ...record, parameters: record.parameters ? structuredClone(record.parameters) : record.parameters };
}

function taskKey(userId: string, id: string): string {
    return `${userId}\u0000${id}`;
}

function jsonValueParse(value: unknown): unknown {
    if (typeof value === "string") {
        return JSON.parse(value);
    }
    return value;
}
