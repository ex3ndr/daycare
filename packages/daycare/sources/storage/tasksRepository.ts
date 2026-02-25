import type { DatabaseSync } from "node:sqlite";
import type { Context } from "@/types";
import { AsyncLock } from "../util/lock.js";
import type { DatabaseTaskRow, TaskDbRecord } from "./databaseTypes.js";

/**
 * Unified tasks repository backed by SQLite with write-through caching.
 * Expects: schema migrations already applied for tasks.
 */
export class TasksRepository {
    private readonly db: DatabaseSync;
    private readonly tasksById = new Map<string, TaskDbRecord>();
    private readonly taskLocks = new Map<string, AsyncLock>();
    private readonly cacheLock = new AsyncLock();
    private readonly createLock = new AsyncLock();

    constructor(db: DatabaseSync) {
        this.db = db;
    }

    async findById(id: string): Promise<TaskDbRecord | null> {
        const cached = this.tasksById.get(id);
        if (cached) {
            return cached.deletedAt == null ? taskClone(cached) : null;
        }

        const lock = this.taskLockForId(id);
        return lock.inLock(async () => {
            const existing = this.tasksById.get(id);
            if (existing) {
                return existing.deletedAt == null ? taskClone(existing) : null;
            }
            const loaded = this.taskLoadById(id);
            if (!loaded) {
                return null;
            }
            await this.cacheLock.inLock(() => {
                this.taskCacheSet(loaded);
            });
            return loaded.deletedAt == null ? taskClone(loaded) : null;
        });
    }

    async findAnyById(id: string): Promise<TaskDbRecord | null> {
        const cached = this.tasksById.get(id);
        if (cached) {
            return taskClone(cached);
        }

        const lock = this.taskLockForId(id);
        return lock.inLock(async () => {
            const existing = this.tasksById.get(id);
            if (existing) {
                return taskClone(existing);
            }
            const loaded = this.taskLoadById(id);
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
        const rows = this.db
            .prepare("SELECT * FROM tasks WHERE user_id = ? AND deleted_at IS NULL ORDER BY updated_at ASC")
            .all(ctx.userId) as DatabaseTaskRow[];
        return rows.map((row) => taskClone(this.taskParse(row)));
    }

    async findAll(): Promise<TaskDbRecord[]> {
        const rows = this.db
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
            const existing = this.taskLoadById(record.id);
            if (existing?.deletedAt != null) {
                throw new Error(`Task id is reserved by a deleted task: ${record.id}`);
            }

            this.db
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
                    ON CONFLICT(id) DO UPDATE SET
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
                    record.userId,
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
                    deletedAt: record.deletedAt ?? null
                });
            });
        });
    }

    async update(id: string, data: Partial<TaskDbRecord>): Promise<void> {
        const lock = this.taskLockForId(id);
        await lock.inLock(async () => {
            const current = this.tasksById.get(id) ?? this.taskLoadById(id);
            if (!current) {
                throw new Error(`Task not found: ${id}`);
            }

            const next: TaskDbRecord = {
                ...current,
                ...data,
                id: current.id,
                userId: data.userId ?? current.userId,
                description: data.description === undefined ? current.description : data.description,
                deletedAt: data.deletedAt === undefined ? current.deletedAt : data.deletedAt
            };

            this.db
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
                    WHERE id = ?
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
                    id
                );

            await this.cacheLock.inLock(() => {
                this.taskCacheSet(next);
            });
        });
    }

    async delete(id: string): Promise<boolean> {
        const lock = this.taskLockForId(id);
        return lock.inLock(async () => {
            const current = this.tasksById.get(id) ?? this.taskLoadById(id);
            if (!current || current.deletedAt != null) {
                return false;
            }
            const now = Date.now();
            this.db
                .prepare("UPDATE tasks SET deleted_at = ?, updated_at = ? WHERE id = ? AND deleted_at IS NULL")
                .run(now, now, id);
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
        this.tasksById.set(record.id, taskClone(record));
    }

    private taskLoadById(id: string): TaskDbRecord | null {
        const row = this.db.prepare("SELECT * FROM tasks WHERE id = ? LIMIT 1").get(id) as DatabaseTaskRow | undefined;
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
