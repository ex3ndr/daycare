import type { DatabaseSync } from "node:sqlite";
import type { Context } from "@/types";
import { AsyncLock } from "../util/lock.js";
import type { CronTaskDbRecord, DatabaseCronTaskRow } from "./databaseTypes.js";

export type CronTasksFindManyOptions = {
    includeDisabled?: boolean;
};

/**
 * Cron tasks repository backed by SQLite with write-through caching.
 * Expects: schema migrations already applied for tasks_cron.
 */
export class CronTasksRepository {
    private readonly db: DatabaseSync;
    private readonly tasksById = new Map<string, CronTaskDbRecord>();
    private readonly taskLocks = new Map<string, AsyncLock>();
    private readonly cacheLock = new AsyncLock();
    private readonly createLock = new AsyncLock();
    private allTasksLoaded = false;

    constructor(db: DatabaseSync) {
        this.db = db;
    }

    async findById(id: string): Promise<CronTaskDbRecord | null> {
        const cached = this.tasksById.get(id);
        if (cached) {
            return cronTaskClone(cached);
        }
        if (this.allTasksLoaded) {
            return null;
        }

        const lock = this.taskLockForId(id);
        return lock.inLock(async () => {
            const existing = this.tasksById.get(id);
            if (existing) {
                return cronTaskClone(existing);
            }
            const loaded = this.taskLoadById(id);
            if (!loaded) {
                return null;
            }
            await this.cacheLock.inLock(() => {
                this.taskCacheSet(loaded);
            });
            return cronTaskClone(loaded);
        });
    }

    async findMany(ctx: Context, options: CronTasksFindManyOptions = {}): Promise<CronTaskDbRecord[]> {
        const includeDisabled = options.includeDisabled === true;
        const rows = includeDisabled
            ? (this.db
                  .prepare("SELECT * FROM tasks_cron WHERE user_id = ? ORDER BY updated_at ASC")
                  .all(ctx.userId) as DatabaseCronTaskRow[])
            : (this.db
                  .prepare("SELECT * FROM tasks_cron WHERE user_id = ? AND enabled = 1 ORDER BY updated_at ASC")
                  .all(ctx.userId) as DatabaseCronTaskRow[]);
        return rows.map((row) => cronTaskClone(this.taskParse(row)));
    }

    async findAll(options: CronTasksFindManyOptions = {}): Promise<CronTaskDbRecord[]> {
        const includeDisabled = options.includeDisabled === true;

        if (this.allTasksLoaded) {
            const all = cronTasksSort(Array.from(this.tasksById.values()));
            const visible = includeDisabled ? all : all.filter((task) => task.enabled);
            return visible.map((task) => cronTaskClone(task));
        }

        const rows = includeDisabled
            ? (this.db.prepare("SELECT * FROM tasks_cron ORDER BY updated_at ASC").all() as DatabaseCronTaskRow[])
            : (this.db
                  .prepare("SELECT * FROM tasks_cron WHERE enabled = 1 ORDER BY updated_at ASC")
                  .all() as DatabaseCronTaskRow[]);
        const parsed = rows.map((row) => this.taskParse(row));

        await this.cacheLock.inLock(() => {
            if (includeDisabled) {
                this.tasksById.clear();
            }
            for (const task of parsed) {
                this.taskCacheSet(task);
            }
            if (includeDisabled) {
                this.allTasksLoaded = true;
            }
        });

        return parsed.map((task) => cronTaskClone(task));
    }

    async create(record: CronTaskDbRecord): Promise<void> {
        await this.createLock.inLock(async () => {
            this.db
                .prepare(
                    `
                  INSERT INTO tasks_cron (
                    id,
                    task_uid,
                    user_id,
                    name,
                    description,
                    schedule,
                    prompt,
                    agent_id,
                    enabled,
                    delete_after_run,
                    last_run_at,
                    created_at,
                    updated_at
                  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                  ON CONFLICT(id) DO UPDATE SET
                    task_uid = excluded.task_uid,
                    user_id = excluded.user_id,
                    name = excluded.name,
                    description = excluded.description,
                    schedule = excluded.schedule,
                    prompt = excluded.prompt,
                    agent_id = excluded.agent_id,
                    enabled = excluded.enabled,
                    delete_after_run = excluded.delete_after_run,
                    last_run_at = excluded.last_run_at,
                    created_at = excluded.created_at,
                    updated_at = excluded.updated_at
                `
                )
                .run(
                    record.id,
                    record.taskUid,
                    record.userId,
                    record.name,
                    record.description,
                    record.schedule,
                    record.prompt,
                    record.agentId,
                    record.enabled ? 1 : 0,
                    record.deleteAfterRun ? 1 : 0,
                    record.lastRunAt,
                    record.createdAt,
                    record.updatedAt
                );

            await this.cacheLock.inLock(() => {
                this.taskCacheSet(record);
            });
        });
    }

    async update(id: string, data: Partial<CronTaskDbRecord>): Promise<void> {
        const lock = this.taskLockForId(id);
        await lock.inLock(async () => {
            const current = this.tasksById.get(id) ?? this.taskLoadById(id);
            if (!current) {
                throw new Error(`Cron task not found: ${id}`);
            }

            const next: CronTaskDbRecord = {
                ...current,
                ...data,
                id: current.id,
                taskUid: data.taskUid ?? current.taskUid,
                userId: data.userId === undefined ? current.userId : data.userId,
                description: data.description === undefined ? current.description : data.description,
                agentId: data.agentId === undefined ? current.agentId : data.agentId,
                lastRunAt: data.lastRunAt === undefined ? current.lastRunAt : data.lastRunAt
            };

            this.db
                .prepare(
                    `
                  UPDATE tasks_cron
                  SET
                    task_uid = ?,
                    user_id = ?,
                    name = ?,
                    description = ?,
                    schedule = ?,
                    prompt = ?,
                    agent_id = ?,
                    enabled = ?,
                    delete_after_run = ?,
                    last_run_at = ?,
                    created_at = ?,
                    updated_at = ?
                  WHERE id = ?
                `
                )
                .run(
                    next.taskUid,
                    next.userId,
                    next.name,
                    next.description,
                    next.schedule,
                    next.prompt,
                    next.agentId,
                    next.enabled ? 1 : 0,
                    next.deleteAfterRun ? 1 : 0,
                    next.lastRunAt,
                    next.createdAt,
                    next.updatedAt,
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
            const removed = this.db.prepare("DELETE FROM tasks_cron WHERE id = ?").run(id);
            const rawChanges = (removed as { changes?: number | bigint }).changes;
            const changes = typeof rawChanges === "bigint" ? Number(rawChanges) : (rawChanges ?? 0);

            await this.cacheLock.inLock(() => {
                this.tasksById.delete(id);
            });

            return changes > 0;
        });
    }

    private taskCacheSet(record: CronTaskDbRecord): void {
        this.tasksById.set(record.id, cronTaskClone(record));
    }

    private taskLoadById(id: string): CronTaskDbRecord | null {
        const row = this.db.prepare("SELECT * FROM tasks_cron WHERE id = ? LIMIT 1").get(id) as
            | DatabaseCronTaskRow
            | undefined;
        if (!row) {
            return null;
        }
        return this.taskParse(row);
    }

    private taskParse(row: DatabaseCronTaskRow): CronTaskDbRecord {
        return {
            id: row.id,
            taskUid: row.task_uid,
            userId: row.user_id,
            name: row.name,
            description: row.description,
            schedule: row.schedule,
            prompt: row.prompt,
            agentId: row.agent_id,
            enabled: row.enabled === 1,
            deleteAfterRun: row.delete_after_run === 1,
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

function cronTaskClone(record: CronTaskDbRecord): CronTaskDbRecord {
    return { ...record };
}

function cronTasksSort(records: CronTaskDbRecord[]): CronTaskDbRecord[] {
    return records.slice().sort((left, right) => left.updatedAt - right.updatedAt);
}
