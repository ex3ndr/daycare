import type { DatabaseSync } from "node:sqlite";
import type { Context } from "@/types";
import { AsyncLock } from "../util/lock.js";
import type { DatabaseHeartbeatTaskRow, HeartbeatTaskDbRecord } from "./databaseTypes.js";

/**
 * Heartbeat tasks repository backed by SQLite with write-through caching.
 * Expects: schema migrations already applied for tasks_heartbeat.
 */
export class HeartbeatTasksRepository {
    private readonly db: DatabaseSync;
    private readonly tasksById = new Map<string, HeartbeatTaskDbRecord>();
    private readonly taskLocks = new Map<string, AsyncLock>();
    private readonly cacheLock = new AsyncLock();
    private readonly createLock = new AsyncLock();
    private readonly runLock = new AsyncLock();
    private allTasksLoaded = false;

    constructor(db: DatabaseSync) {
        this.db = db;
    }

    async findById(id: string): Promise<HeartbeatTaskDbRecord | null> {
        const cached = this.tasksById.get(id);
        if (cached) {
            return heartbeatTaskClone(cached);
        }
        if (this.allTasksLoaded) {
            return null;
        }

        const lock = this.taskLockForId(id);
        return lock.inLock(async () => {
            const existing = this.tasksById.get(id);
            if (existing) {
                return heartbeatTaskClone(existing);
            }
            const loaded = this.taskLoadById(id);
            if (!loaded) {
                return null;
            }
            await this.cacheLock.inLock(() => {
                this.taskCacheSet(loaded);
            });
            return heartbeatTaskClone(loaded);
        });
    }

    async findMany(ctx: Context): Promise<HeartbeatTaskDbRecord[]> {
        const rows = this.db
            .prepare("SELECT * FROM tasks_heartbeat WHERE user_id = ? ORDER BY updated_at ASC")
            .all(ctx.userId) as DatabaseHeartbeatTaskRow[];
        return rows.map((task) => heartbeatTaskClone(this.taskParse(task)));
    }

    async findAll(): Promise<HeartbeatTaskDbRecord[]> {
        if (this.allTasksLoaded) {
            return heartbeatTasksSort(Array.from(this.tasksById.values())).map((task) => heartbeatTaskClone(task));
        }

        const rows = this.db
            .prepare("SELECT * FROM tasks_heartbeat ORDER BY updated_at ASC")
            .all() as DatabaseHeartbeatTaskRow[];
        const parsed = rows.map((row) => this.taskParse(row));

        await this.cacheLock.inLock(() => {
            this.tasksById.clear();
            for (const task of parsed) {
                this.taskCacheSet(task);
            }
            this.allTasksLoaded = true;
        });

        return parsed.map((task) => heartbeatTaskClone(task));
    }

    async create(record: HeartbeatTaskDbRecord): Promise<void> {
        await this.createLock.inLock(async () => {
            this.db
                .prepare(
                    `
                  INSERT INTO tasks_heartbeat (
                    id,
                    user_id,
                    title,
                    code,
                    last_run_at,
                    created_at,
                    updated_at
                  ) VALUES (?, ?, ?, ?, ?, ?, ?)
                  ON CONFLICT(id) DO UPDATE SET
                    user_id = excluded.user_id,
                    title = excluded.title,
                    code = excluded.code,
                    last_run_at = excluded.last_run_at,
                    created_at = excluded.created_at,
                    updated_at = excluded.updated_at
                `
                )
                .run(
                    record.id,
                    record.userId,
                    record.title,
                    record.code,
                    record.lastRunAt,
                    record.createdAt,
                    record.updatedAt
                );

            await this.cacheLock.inLock(() => {
                this.taskCacheSet(record);
            });
        });
    }

    async update(id: string, data: Partial<HeartbeatTaskDbRecord>): Promise<void> {
        const lock = this.taskLockForId(id);
        await lock.inLock(async () => {
            const current = this.tasksById.get(id) ?? this.taskLoadById(id);
            if (!current) {
                throw new Error(`Heartbeat task not found: ${id}`);
            }

            const next: HeartbeatTaskDbRecord = {
                ...current,
                ...data,
                id: current.id,
                userId: data.userId ?? current.userId,
                lastRunAt: data.lastRunAt === undefined ? current.lastRunAt : data.lastRunAt
            };

            this.db
                .prepare(
                    `
                  UPDATE tasks_heartbeat
                  SET
                    user_id = ?,
                    title = ?,
                    code = ?,
                    last_run_at = ?,
                    created_at = ?,
                    updated_at = ?
                  WHERE id = ?
                `
                )
                .run(next.userId, next.title, next.code, next.lastRunAt, next.createdAt, next.updatedAt, id);

            await this.cacheLock.inLock(() => {
                this.taskCacheSet(next);
            });
        });
    }

    async delete(id: string): Promise<boolean> {
        const lock = this.taskLockForId(id);
        return lock.inLock(async () => {
            const removed = this.db.prepare("DELETE FROM tasks_heartbeat WHERE id = ?").run(id);
            const rawChanges = (removed as { changes?: number | bigint }).changes;
            const changes = typeof rawChanges === "bigint" ? Number(rawChanges) : (rawChanges ?? 0);

            await this.cacheLock.inLock(() => {
                this.tasksById.delete(id);
            });

            return changes > 0;
        });
    }

    async recordRun(runAt: number): Promise<void> {
        await this.runLock.inLock(async () => {
            this.db.prepare("UPDATE tasks_heartbeat SET last_run_at = ?, updated_at = ?").run(runAt, runAt);
            await this.cacheLock.inLock(() => {
                for (const [taskId, task] of this.tasksById.entries()) {
                    this.tasksById.set(taskId, {
                        ...task,
                        lastRunAt: runAt,
                        updatedAt: runAt
                    });
                }
            });
        });
    }

    private taskCacheSet(record: HeartbeatTaskDbRecord): void {
        this.tasksById.set(record.id, heartbeatTaskClone(record));
    }

    private taskLoadById(id: string): HeartbeatTaskDbRecord | null {
        const row = this.db.prepare("SELECT * FROM tasks_heartbeat WHERE id = ? LIMIT 1").get(id) as
            | DatabaseHeartbeatTaskRow
            | undefined;
        if (!row) {
            return null;
        }
        return this.taskParse(row);
    }

    private taskParse(row: DatabaseHeartbeatTaskRow): HeartbeatTaskDbRecord {
        return {
            id: row.id,
            userId: row.user_id,
            title: row.title,
            code: row.code,
            lastRunAt: row.last_run_at,
            createdAt: row.created_at,
            updatedAt: row.updated_at
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

function heartbeatTaskClone(record: HeartbeatTaskDbRecord): HeartbeatTaskDbRecord {
    return { ...record };
}

function heartbeatTasksSort(records: HeartbeatTaskDbRecord[]): HeartbeatTaskDbRecord[] {
    return records.slice().sort((left, right) => left.updatedAt - right.updatedAt);
}
