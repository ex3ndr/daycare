import { and, asc, eq, isNull } from "drizzle-orm";
import type { Context } from "@/types";
import type { DaycareDb } from "../schema.js";
import { tasksHeartbeatTable } from "../schema.js";
import { AsyncLock } from "../util/lock.js";
import type { HeartbeatTaskDbRecord } from "./databaseTypes.js";
import { versionAdvance } from "./versionAdvance.js";

/**
 * Heartbeat tasks repository backed by Drizzle with write-through caching.
 * Expects: schema migrations already applied for tasks_heartbeat.
 */
export class HeartbeatTasksRepository {
    private readonly db: DaycareDb;
    private readonly tasksById = new Map<string, HeartbeatTaskDbRecord>();
    private readonly taskLocks = new Map<string, AsyncLock>();
    private readonly cacheLock = new AsyncLock();
    private readonly createLock = new AsyncLock();
    private readonly runLock = new AsyncLock();
    private allTasksLoaded = false;

    constructor(db: DaycareDb) {
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
            const loaded = await this.taskLoadById(id);
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
        const rows = await this.db
            .select()
            .from(tasksHeartbeatTable)
            .where(and(eq(tasksHeartbeatTable.userId, ctx.userId), isNull(tasksHeartbeatTable.validTo)))
            .orderBy(asc(tasksHeartbeatTable.updatedAt));
        return rows.map((row) => heartbeatTaskClone(heartbeatTaskParse(row)));
    }

    async findAll(): Promise<HeartbeatTaskDbRecord[]> {
        if (this.allTasksLoaded) {
            return heartbeatTasksSort(Array.from(this.tasksById.values())).map((task) => heartbeatTaskClone(task));
        }

        const rows = await this.db
            .select()
            .from(tasksHeartbeatTable)
            .where(isNull(tasksHeartbeatTable.validTo))
            .orderBy(asc(tasksHeartbeatTable.updatedAt));
        const parsed = rows.map((row) => heartbeatTaskParse(row));

        await this.cacheLock.inLock(() => {
            this.tasksById.clear();
            for (const task of parsed) {
                this.taskCacheSet(task);
            }
            this.allTasksLoaded = true;
        });

        return parsed.map((task) => heartbeatTaskClone(task));
    }

    async findManyByTaskId(ctx: Context, taskId: string): Promise<HeartbeatTaskDbRecord[]> {
        const rows = await this.db
            .select()
            .from(tasksHeartbeatTable)
            .where(
                and(
                    eq(tasksHeartbeatTable.userId, ctx.userId),
                    eq(tasksHeartbeatTable.taskId, taskId),
                    isNull(tasksHeartbeatTable.validTo)
                )
            )
            .orderBy(asc(tasksHeartbeatTable.updatedAt));
        return rows.map((row) => heartbeatTaskClone(heartbeatTaskParse(row)));
    }

    async create(record: HeartbeatTaskDbRecord): Promise<void> {
        const taskId = record.taskId.trim();
        if (!taskId) {
            throw new Error("Heartbeat trigger taskId is required.");
        }
        await this.createLock.inLock(async () => {
            const current = this.tasksById.get(record.id) ?? (await this.taskLoadById(record.id));
            let next: HeartbeatTaskDbRecord;
            if (!current) {
                next = {
                    ...record,
                    taskId,
                    version: 1,
                    validFrom: record.createdAt,
                    validTo: null
                };
                await this.db.insert(tasksHeartbeatTable).values({
                    id: next.id,
                    version: next.version ?? 1,
                    validFrom: next.validFrom ?? next.createdAt,
                    validTo: next.validTo ?? null,
                    taskId: next.taskId,
                    userId: next.userId,
                    title: next.title,
                    parameters: next.parameters ? JSON.stringify(next.parameters) : null,
                    lastRunAt: next.lastRunAt,
                    createdAt: next.createdAt,
                    updatedAt: next.updatedAt
                });
            } else {
                next = await versionAdvance<HeartbeatTaskDbRecord>({
                    changes: {
                        taskId,
                        userId: record.userId,
                        title: record.title,
                        parameters: record.parameters ? JSON.stringify(record.parameters) : null,
                        lastRunAt: record.lastRunAt,
                        createdAt: record.createdAt,
                        updatedAt: record.updatedAt
                    },
                    findCurrent: async () => current,
                    closeCurrent: async (row, now) => {
                        await this.db
                            .update(tasksHeartbeatTable)
                            .set({ validTo: now })
                            .where(
                                and(
                                    eq(tasksHeartbeatTable.id, row.id),
                                    eq(tasksHeartbeatTable.version, row.version ?? 1),
                                    isNull(tasksHeartbeatTable.validTo)
                                )
                            );
                    },
                    insertNext: async (row) => {
                        await this.db.insert(tasksHeartbeatTable).values({
                            id: row.id,
                            version: row.version ?? 1,
                            validFrom: row.validFrom ?? row.createdAt,
                            validTo: row.validTo ?? null,
                            taskId: row.taskId,
                            userId: row.userId,
                            title: row.title,
                            parameters: row.parameters ? JSON.stringify(row.parameters) : null,
                            lastRunAt: row.lastRunAt,
                            createdAt: row.createdAt,
                            updatedAt: row.updatedAt
                        });
                    }
                });
            }

            await this.cacheLock.inLock(() => {
                this.taskCacheSet(next);
            });
        });
    }

    async update(id: string, data: Partial<HeartbeatTaskDbRecord>): Promise<void> {
        const lock = this.taskLockForId(id);
        await lock.inLock(async () => {
            const current = this.tasksById.get(id) ?? (await this.taskLoadById(id));
            if (!current) {
                throw new Error(`Heartbeat task not found: ${id}`);
            }

            const next: HeartbeatTaskDbRecord = {
                ...current,
                ...data,
                id: current.id,
                taskId: data.taskId ?? current.taskId,
                userId: data.userId ?? current.userId,
                parameters: data.parameters === undefined ? current.parameters : data.parameters,
                lastRunAt: data.lastRunAt === undefined ? current.lastRunAt : data.lastRunAt
            };
            if (!next.taskId.trim()) {
                throw new Error("Heartbeat trigger taskId is required.");
            }

            const advanced = await versionAdvance<HeartbeatTaskDbRecord>({
                changes: {
                    taskId: next.taskId.trim(),
                    userId: next.userId,
                    title: next.title,
                    parameters: next.parameters ? JSON.stringify(next.parameters) : null,
                    lastRunAt: next.lastRunAt,
                    createdAt: next.createdAt,
                    updatedAt: next.updatedAt
                },
                findCurrent: async () => current,
                closeCurrent: async (row, now) => {
                    await this.db
                        .update(tasksHeartbeatTable)
                        .set({ validTo: now })
                        .where(
                            and(
                                eq(tasksHeartbeatTable.id, row.id),
                                eq(tasksHeartbeatTable.version, row.version ?? 1),
                                isNull(tasksHeartbeatTable.validTo)
                            )
                        );
                },
                insertNext: async (row) => {
                    await this.db.insert(tasksHeartbeatTable).values({
                        id: row.id,
                        version: row.version ?? 1,
                        validFrom: row.validFrom ?? row.createdAt,
                        validTo: row.validTo ?? null,
                        taskId: row.taskId,
                        userId: row.userId,
                        title: row.title,
                        parameters: row.parameters ? JSON.stringify(row.parameters) : null,
                        lastRunAt: row.lastRunAt,
                        createdAt: row.createdAt,
                        updatedAt: row.updatedAt
                    });
                }
            });

            await this.cacheLock.inLock(() => {
                this.taskCacheSet(advanced);
            });
        });
    }

    async delete(id: string): Promise<boolean> {
        const lock = this.taskLockForId(id);
        return lock.inLock(async () => {
            const current = this.tasksById.get(id) ?? (await this.taskLoadById(id));
            if (!current) {
                return false;
            }

            await this.db
                .update(tasksHeartbeatTable)
                .set({ validTo: Date.now() })
                .where(
                    and(
                        eq(tasksHeartbeatTable.id, current.id),
                        eq(tasksHeartbeatTable.version, current.version ?? 1),
                        isNull(tasksHeartbeatTable.validTo)
                    )
                );

            await this.cacheLock.inLock(() => {
                this.tasksById.delete(id);
            });

            return true;
        });
    }

    async recordRun(runAt: number): Promise<void> {
        await this.runLock.inLock(async () => {
            const currentRows = await this.db
                .select()
                .from(tasksHeartbeatTable)
                .where(isNull(tasksHeartbeatTable.validTo))
                .orderBy(asc(tasksHeartbeatTable.id));

            for (const row of currentRows) {
                const current = heartbeatTaskParse(row);
                const next = await versionAdvance<HeartbeatTaskDbRecord>({
                    now: runAt,
                    changes: { lastRunAt: runAt, updatedAt: runAt },
                    findCurrent: async () => current,
                    closeCurrent: async (record, now) => {
                        await this.db
                            .update(tasksHeartbeatTable)
                            .set({ validTo: now })
                            .where(
                                and(
                                    eq(tasksHeartbeatTable.id, record.id),
                                    eq(tasksHeartbeatTable.version, record.version ?? 1),
                                    isNull(tasksHeartbeatTable.validTo)
                                )
                            );
                    },
                    insertNext: async (record) => {
                        await this.db.insert(tasksHeartbeatTable).values({
                            id: record.id,
                            version: record.version ?? 1,
                            validFrom: record.validFrom ?? record.createdAt,
                            validTo: record.validTo ?? null,
                            taskId: record.taskId,
                            userId: record.userId,
                            title: record.title,
                            parameters: record.parameters ? JSON.stringify(record.parameters) : null,
                            lastRunAt: record.lastRunAt,
                            createdAt: record.createdAt,
                            updatedAt: record.updatedAt
                        });
                    }
                });
                await this.cacheLock.inLock(() => {
                    this.taskCacheSet(next);
                });
            }
        });
    }

    private taskCacheSet(record: HeartbeatTaskDbRecord): void {
        this.tasksById.set(record.id, heartbeatTaskClone(record));
    }

    private async taskLoadById(id: string): Promise<HeartbeatTaskDbRecord | null> {
        const rows = await this.db
            .select()
            .from(tasksHeartbeatTable)
            .where(and(eq(tasksHeartbeatTable.id, id), isNull(tasksHeartbeatTable.validTo)))
            .limit(1);
        const row = rows[0];
        if (!row) {
            return null;
        }
        return heartbeatTaskParse(row);
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

function heartbeatTaskParse(row: typeof tasksHeartbeatTable.$inferSelect): HeartbeatTaskDbRecord {
    const taskId = row.taskId?.trim();
    if (!taskId) {
        throw new Error(`Heartbeat trigger ${row.id} is missing required task_id.`);
    }
    return {
        id: row.id,
        version: row.version ?? 1,
        validFrom: row.validFrom ?? row.createdAt,
        validTo: row.validTo ?? null,
        taskId,
        userId: row.userId,
        title: row.title,
        parameters: row.parameters ? JSON.parse(row.parameters) : null,
        lastRunAt: row.lastRunAt,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt
    };
}

function heartbeatTaskClone(record: HeartbeatTaskDbRecord): HeartbeatTaskDbRecord {
    return { ...record, parameters: record.parameters ? structuredClone(record.parameters) : record.parameters };
}

function heartbeatTasksSort(records: HeartbeatTaskDbRecord[]): HeartbeatTaskDbRecord[] {
    return records.slice().sort((left, right) => left.updatedAt - right.updatedAt);
}
