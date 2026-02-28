import { and, asc, eq } from "drizzle-orm";
import type { Context } from "@/types";
import type { DaycareDb } from "../schema.js";
import { tasksCronTable } from "../schema.js";
import { AsyncLock } from "../util/lock.js";
import type { CronTaskDbRecord } from "./databaseTypes.js";

export type CronTasksFindManyOptions = {
    includeDisabled?: boolean;
};

/**
 * Cron tasks repository backed by Drizzle with write-through caching.
 * Expects: schema migrations already applied for tasks_cron.
 */
export class CronTasksRepository {
    private readonly db: DaycareDb;
    private readonly tasksById = new Map<string, CronTaskDbRecord>();
    private readonly taskLocks = new Map<string, AsyncLock>();
    private readonly cacheLock = new AsyncLock();
    private readonly createLock = new AsyncLock();
    private allTasksLoaded = false;

    constructor(db: DaycareDb) {
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
            const loaded = await this.taskLoadById(id);
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
        const conditions = [eq(tasksCronTable.userId, ctx.userId)];
        if (!includeDisabled) {
            conditions.push(eq(tasksCronTable.enabled, 1));
        }
        const rows = await this.db
            .select()
            .from(tasksCronTable)
            .where(and(...conditions))
            .orderBy(asc(tasksCronTable.updatedAt));
        return rows.map((row) => cronTaskClone(cronTaskParse(row)));
    }

    async findAll(options: CronTasksFindManyOptions = {}): Promise<CronTaskDbRecord[]> {
        const includeDisabled = options.includeDisabled === true;

        if (this.allTasksLoaded) {
            const all = cronTasksSort(Array.from(this.tasksById.values()));
            const visible = includeDisabled ? all : all.filter((task) => task.enabled);
            return visible.map((task) => cronTaskClone(task));
        }

        const query = this.db.select().from(tasksCronTable);
        const rows = includeDisabled
            ? await query.orderBy(asc(tasksCronTable.updatedAt))
            : await query.where(eq(tasksCronTable.enabled, 1)).orderBy(asc(tasksCronTable.updatedAt));
        const parsed = rows.map((row) => cronTaskParse(row));

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

    async findManyByTaskId(ctx: Context, taskId: string): Promise<CronTaskDbRecord[]> {
        const rows = await this.db
            .select()
            .from(tasksCronTable)
            .where(and(eq(tasksCronTable.userId, ctx.userId), eq(tasksCronTable.taskId, taskId)))
            .orderBy(asc(tasksCronTable.updatedAt));
        return rows.map((row) => cronTaskClone(cronTaskParse(row)));
    }

    async create(record: CronTaskDbRecord): Promise<void> {
        const taskId = record.taskId.trim();
        if (!taskId) {
            throw new Error("Cron trigger taskId is required.");
        }
        const timezone = timezoneNormalize(record.timezone);
        await this.createLock.inLock(async () => {
            await this.db
                .insert(tasksCronTable)
                .values({
                    id: record.id,
                    taskId,
                    userId: record.userId,
                    name: record.name,
                    description: record.description,
                    schedule: record.schedule,
                    timezone,
                    agentId: record.agentId,
                    enabled: record.enabled ? 1 : 0,
                    deleteAfterRun: record.deleteAfterRun ? 1 : 0,
                    parameters: record.parameters ? JSON.stringify(record.parameters) : null,
                    lastRunAt: record.lastRunAt,
                    createdAt: record.createdAt,
                    updatedAt: record.updatedAt
                })
                .onConflictDoUpdate({
                    target: tasksCronTable.id,
                    set: {
                        taskId,
                        userId: record.userId,
                        name: record.name,
                        description: record.description,
                        schedule: record.schedule,
                        timezone,
                        agentId: record.agentId,
                        enabled: record.enabled ? 1 : 0,
                        deleteAfterRun: record.deleteAfterRun ? 1 : 0,
                        parameters: record.parameters ? JSON.stringify(record.parameters) : null,
                        lastRunAt: record.lastRunAt,
                        createdAt: record.createdAt,
                        updatedAt: record.updatedAt
                    }
                });

            await this.cacheLock.inLock(() => {
                this.taskCacheSet(record);
            });
        });
    }

    async update(id: string, data: Partial<CronTaskDbRecord>): Promise<void> {
        const lock = this.taskLockForId(id);
        await lock.inLock(async () => {
            const current = this.tasksById.get(id) ?? (await this.taskLoadById(id));
            if (!current) {
                throw new Error(`Cron task not found: ${id}`);
            }

            const next: CronTaskDbRecord = {
                ...current,
                ...data,
                id: current.id,
                taskId: data.taskId ?? current.taskId,
                userId: data.userId === undefined ? current.userId : data.userId,
                description: data.description === undefined ? current.description : data.description,
                timezone: data.timezone === undefined ? current.timezone : data.timezone,
                agentId: data.agentId === undefined ? current.agentId : data.agentId,
                parameters: data.parameters === undefined ? current.parameters : data.parameters,
                lastRunAt: data.lastRunAt === undefined ? current.lastRunAt : data.lastRunAt
            };
            if (!next.taskId.trim()) {
                throw new Error("Cron trigger taskId is required.");
            }
            next.timezone = timezoneNormalize(next.timezone);

            await this.db
                .update(tasksCronTable)
                .set({
                    taskId: next.taskId.trim(),
                    userId: next.userId,
                    name: next.name,
                    description: next.description,
                    schedule: next.schedule,
                    timezone: next.timezone,
                    agentId: next.agentId,
                    enabled: next.enabled ? 1 : 0,
                    deleteAfterRun: next.deleteAfterRun ? 1 : 0,
                    parameters: next.parameters ? JSON.stringify(next.parameters) : null,
                    lastRunAt: next.lastRunAt,
                    createdAt: next.createdAt,
                    updatedAt: next.updatedAt
                })
                .where(eq(tasksCronTable.id, id));

            await this.cacheLock.inLock(() => {
                this.taskCacheSet(next);
            });
        });
    }

    async delete(id: string): Promise<boolean> {
        const lock = this.taskLockForId(id);
        return lock.inLock(async () => {
            const result = await this.db
                .delete(tasksCronTable)
                .where(eq(tasksCronTable.id, id))
                .returning({ id: tasksCronTable.id });

            await this.cacheLock.inLock(() => {
                this.tasksById.delete(id);
            });

            return result.length > 0;
        });
    }

    private taskCacheSet(record: CronTaskDbRecord): void {
        this.tasksById.set(record.id, cronTaskClone(record));
    }

    private async taskLoadById(id: string): Promise<CronTaskDbRecord | null> {
        const rows = await this.db.select().from(tasksCronTable).where(eq(tasksCronTable.id, id)).limit(1);
        const row = rows[0];
        if (!row) {
            return null;
        }
        return cronTaskParse(row);
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

function cronTaskParse(row: typeof tasksCronTable.$inferSelect): CronTaskDbRecord {
    const taskId = row.taskId?.trim();
    if (!taskId) {
        throw new Error(`Cron trigger ${row.id} is missing required task_id.`);
    }
    return {
        id: row.id,
        taskId,
        userId: row.userId,
        name: row.name,
        description: row.description,
        schedule: row.schedule,
        timezone: timezoneNormalize(row.timezone),
        agentId: row.agentId,
        enabled: row.enabled === 1,
        deleteAfterRun: row.deleteAfterRun === 1,
        parameters: row.parameters ? JSON.parse(row.parameters) : null,
        lastRunAt: row.lastRunAt,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt
    };
}

function cronTaskClone(record: CronTaskDbRecord): CronTaskDbRecord {
    return { ...record };
}

function cronTasksSort(records: CronTaskDbRecord[]): CronTaskDbRecord[] {
    return records.slice().sort((left, right) => left.updatedAt - right.updatedAt);
}

function timezoneNormalize(value: string): string {
    const normalized = value.trim();
    if (!normalized) {
        return "UTC";
    }
    return normalized;
}
