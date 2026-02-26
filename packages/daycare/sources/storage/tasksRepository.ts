import type { Context } from "@/types";
import { AsyncLock } from "../util/lock.js";
import type { StorageDatabase } from "./databaseOpen.js";
import type { DatabaseTaskRow, TaskDbRecord } from "./databaseTypes.js";

/**
 * Unified tasks repository backed by SQLite with write-through caching.
 * Expects: schema migrations already applied for tasks.
 */
export class TasksRepository {
    private readonly db: StorageDatabase;
    private readonly tasksById = new Map<string, TaskDbRecord>();
    private readonly taskLocks = new Map<string, AsyncLock>();
    private readonly cacheLock = new AsyncLock();
    private readonly createLock = new AsyncLock();

    constructor(db: StorageDatabase) {
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
            .prepare("SELECT * FROM tasks WHERE user_id = ? AND deleted_at IS NULL ORDER BY updated_at ASC")
            .all(ctx.userId) as DatabaseTaskRow[];
        return rows.map((row) => taskClone(this.taskParse(row)));
    }

    async findAll(): Promise<TaskDbRecord[]> {
        const rows = await this.db
            .prepare("SELECT * FROM tasks WHERE deleted_at IS NULL ORDER BY updated_at ASC")
            .all() as DatabaseTaskRow[];
        const parsed = rows.map((row) => this.taskParse(row));

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
                .prepare(
                    `
                    INSERT INTO tasks (
                        id,
                        user_id,
                        title,
                        description,
                        code,
                        created_at,
                        updated_at,
                        deleted_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    ON CONFLICT(user_id, id) DO UPDATE SET
                        user_id = excluded.user_id,
                        title = excluded.title,
                        description = excluded.description,
                        code = excluded.code,
                        created_at = excluded.created_at,
                        updated_at = excluded.updated_at,
                        deleted_at = excluded.deleted_at
                    `
                )
                .run(
                    record.id,
                    userId,
                    record.title,
                    record.description,
                    record.code,
                    record.createdAt,
                    record.updatedAt,
                    record.deletedAt ?? null
                );

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
                .prepare(
                    `
                    UPDATE tasks
                    SET
                        user_id = ?,
                        title = ?,
                        description = ?,
                        code = ?,
                        created_at = ?,
                        updated_at = ?,
                        deleted_at = ?
                    WHERE user_id = ? AND id = ?
                    `
                )
                .run(
                    next.userId,
                    next.title,
                    next.description,
                    next.code,
                    next.createdAt,
                    next.updatedAt,
                    next.deletedAt ?? null,
                    current.userId,
                    id
                );

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
                .prepare(
                    "UPDATE tasks SET deleted_at = ?, updated_at = ? WHERE user_id = ? AND id = ? AND deleted_at IS NULL"
                )
                .run(now, now, userId, id);
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
        const row = await this.db.prepare("SELECT * FROM tasks WHERE user_id = ? AND id = ? LIMIT 1").get(userId, id) as
            | DatabaseTaskRow
            | undefined;
        if (!row) {
            return null;
        }
        return this.taskParse(row);
    }

    private taskParse(row: DatabaseTaskRow): TaskDbRecord {
        return {
            id: row.id,
            userId: row.user_id,
            title: row.title,
            description: row.description,
            code: row.code,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
            deletedAt: row.deleted_at
        };
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

function taskClone(record: TaskDbRecord): TaskDbRecord {
    return { ...record };
}

function taskKey(userId: string, id: string): string {
    return `${userId}\u0000${id}`;
}
