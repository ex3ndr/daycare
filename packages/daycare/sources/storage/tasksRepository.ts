import { and, asc, eq, isNull } from "drizzle-orm";
import type { Context } from "@/types";
import type { DaycareDb } from "../schema.js";
import { tasksTable } from "../schema.js";
import { AsyncLock } from "../util/lock.js";
import type { TaskDbRecord } from "./databaseTypes.js";

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
            return cached.deletedAt == null ? taskClone(cached) : null;
        }

        const lock = this.taskLockForId(key);
        return lock.inLock(async () => {
            const existing = this.tasksById.get(key);
            if (existing) {
                return existing.deletedAt == null ? taskClone(existing) : null;
            }
            const loaded = await this.taskLoadById(userId, id);
            if (!loaded) {
                return null;
            }
            await this.cacheLock.inLock(() => {
                this.taskCacheSet(loaded);
            });
            return loaded.deletedAt == null ? taskClone(loaded) : null;
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

    async findMany(ctx: Context): Promise<TaskDbRecord[]> {
        const rows = await this.db
            .select()
            .from(tasksTable)
            .where(and(eq(tasksTable.userId, ctx.userId), isNull(tasksTable.deletedAt)))
            .orderBy(asc(tasksTable.updatedAt));
        return rows.map((row) => taskClone(taskParse(row)));
    }

    async findAll(): Promise<TaskDbRecord[]> {
        const rows = await this.db
            .select()
            .from(tasksTable)
            .where(isNull(tasksTable.deletedAt))
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
            const existing = await this.taskLoadById(userId, record.id);
            if (existing?.deletedAt != null) {
                throw new Error(`Task id is reserved by a deleted task: ${record.id}`);
            }

            await this.db
                .insert(tasksTable)
                .values({
                    id: record.id,
                    userId,
                    title: record.title,
                    description: record.description,
                    code: record.code,
                    createdAt: record.createdAt,
                    updatedAt: record.updatedAt,
                    deletedAt: record.deletedAt ?? null
                })
                .onConflictDoUpdate({
                    target: [tasksTable.userId, tasksTable.id],
                    set: {
                        userId,
                        title: record.title,
                        description: record.description,
                        code: record.code,
                        createdAt: record.createdAt,
                        updatedAt: record.updatedAt,
                        deletedAt: record.deletedAt ?? null
                    }
                });

            await this.cacheLock.inLock(() => {
                this.taskCacheSet({
                    ...record,
                    userId,
                    deletedAt: record.deletedAt ?? null
                });
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
                deletedAt: data.deletedAt === undefined ? current.deletedAt : data.deletedAt
            };

            await this.db
                .update(tasksTable)
                .set({
                    userId: next.userId,
                    title: next.title,
                    description: next.description,
                    code: next.code,
                    createdAt: next.createdAt,
                    updatedAt: next.updatedAt,
                    deletedAt: next.deletedAt ?? null
                })
                .where(and(eq(tasksTable.userId, current.userId), eq(tasksTable.id, id)));

            await this.cacheLock.inLock(() => {
                this.taskCacheSet(next);
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
            if (!current || current.deletedAt != null) {
                return false;
            }
            const now = Date.now();
            await this.db
                .update(tasksTable)
                .set({ deletedAt: now, updatedAt: now })
                .where(and(eq(tasksTable.userId, userId), eq(tasksTable.id, id), isNull(tasksTable.deletedAt)));
            await this.cacheLock.inLock(() => {
                this.taskCacheSet({
                    ...current,
                    deletedAt: now,
                    updatedAt: now
                });
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
            .where(and(eq(tasksTable.userId, userId), eq(tasksTable.id, id)))
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
        title: row.title,
        description: row.description,
        code: row.code,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        deletedAt: row.deletedAt
    };
}

function taskClone(record: TaskDbRecord): TaskDbRecord {
    return { ...record };
}

function taskKey(userId: string, id: string): string {
    return `${userId}\u0000${id}`;
}
