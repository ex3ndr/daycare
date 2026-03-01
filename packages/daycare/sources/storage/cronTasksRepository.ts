import { and, asc, eq, isNull } from "drizzle-orm";
import type { Context } from "@/types";
import type { DaycareDb } from "../schema.js";
import { tasksCronTable } from "../schema.js";
import { AsyncLock } from "../util/lock.js";
import type { CronTaskDbRecord } from "./databaseTypes.js";
import { versionAdvance } from "./versionAdvance.js";

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
        const conditions = [eq(tasksCronTable.userId, ctx.userId), isNull(tasksCronTable.validTo)];
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

        const query = this.db.select().from(tasksCronTable).where(isNull(tasksCronTable.validTo));
        const rows = includeDisabled
            ? await query.orderBy(asc(tasksCronTable.updatedAt))
            : await this.db
                  .select()
                  .from(tasksCronTable)
                  .where(and(isNull(tasksCronTable.validTo), eq(tasksCronTable.enabled, 1)))
                  .orderBy(asc(tasksCronTable.updatedAt));
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
            .where(
                and(
                    eq(tasksCronTable.userId, ctx.userId),
                    eq(tasksCronTable.taskId, taskId),
                    isNull(tasksCronTable.validTo)
                )
            )
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
            const current = this.tasksById.get(record.id) ?? (await this.taskLoadById(record.id));
            let next: CronTaskDbRecord;
            if (!current) {
                next = {
                    ...record,
                    taskId,
                    timezone,
                    version: 1,
                    validFrom: record.createdAt,
                    validTo: null
                };
                await this.db.insert(tasksCronTable).values({
                    id: next.id,
                    version: next.version ?? 1,
                    validFrom: next.validFrom ?? next.createdAt,
                    validTo: next.validTo ?? null,
                    taskId: next.taskId,
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
                });
            } else {
                next = await this.db.transaction(async (tx) =>
                    versionAdvance<CronTaskDbRecord>({
                        changes: {
                            taskId,
                            userId: record.userId,
                            name: record.name,
                            description: record.description,
                            schedule: record.schedule,
                            timezone,
                            agentId: record.agentId,
                            enabled: record.enabled,
                            deleteAfterRun: record.deleteAfterRun,
                            parameters: record.parameters,
                            lastRunAt: record.lastRunAt,
                            createdAt: record.createdAt,
                            updatedAt: record.updatedAt
                        },
                        findCurrent: async () => current,
                        closeCurrent: async (row, now) => {
                            const closedRows = await tx
                                .update(tasksCronTable)
                                .set({ validTo: now })
                                .where(
                                    and(
                                        eq(tasksCronTable.id, row.id),
                                        eq(tasksCronTable.version, row.version ?? 1),
                                        isNull(tasksCronTable.validTo)
                                    )
                                )
                                .returning({ version: tasksCronTable.version });
                            return closedRows.length;
                        },
                        insertNext: async (row) => {
                            await tx.insert(tasksCronTable).values({
                                id: row.id,
                                version: row.version ?? 1,
                                validFrom: row.validFrom ?? row.createdAt,
                                validTo: row.validTo ?? null,
                                taskId: row.taskId,
                                userId: row.userId,
                                name: row.name,
                                description: row.description,
                                schedule: row.schedule,
                                timezone: row.timezone,
                                agentId: row.agentId,
                                enabled: row.enabled ? 1 : 0,
                                deleteAfterRun: row.deleteAfterRun ? 1 : 0,
                                parameters: row.parameters ? JSON.stringify(row.parameters) : null,
                                lastRunAt: row.lastRunAt,
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
            next.taskId = next.taskId.trim();
            next.timezone = timezoneNormalize(next.timezone);
            if (cronTaskNoChangesIs(current, next)) {
                await this.cacheLock.inLock(() => {
                    this.taskCacheSet(current);
                });
                return;
            }

            if (cronTaskRuntimeOnlyChangeIs(current, next)) {
                await this.db
                    .update(tasksCronTable)
                    .set({
                        lastRunAt: next.lastRunAt,
                        updatedAt: next.updatedAt
                    })
                    .where(
                        and(
                            eq(tasksCronTable.id, current.id),
                            eq(tasksCronTable.version, current.version ?? 1),
                            isNull(tasksCronTable.validTo)
                        )
                    );
                await this.cacheLock.inLock(() => {
                    this.taskCacheSet(next);
                });
                return;
            }

            const advanced = await this.db.transaction(async (tx) =>
                versionAdvance<CronTaskDbRecord>({
                    changes: {
                        taskId: next.taskId,
                        userId: next.userId,
                        name: next.name,
                        description: next.description,
                        schedule: next.schedule,
                        timezone: next.timezone,
                        agentId: next.agentId,
                        enabled: next.enabled,
                        deleteAfterRun: next.deleteAfterRun,
                        parameters: next.parameters,
                        lastRunAt: next.lastRunAt,
                        createdAt: next.createdAt,
                        updatedAt: next.updatedAt
                    },
                    findCurrent: async () => current,
                    closeCurrent: async (row, now) => {
                        const closedRows = await tx
                            .update(tasksCronTable)
                            .set({ validTo: now })
                            .where(
                                and(
                                    eq(tasksCronTable.id, row.id),
                                    eq(tasksCronTable.version, row.version ?? 1),
                                    isNull(tasksCronTable.validTo)
                                )
                            )
                            .returning({ version: tasksCronTable.version });
                        return closedRows.length;
                    },
                    insertNext: async (row) => {
                        await tx.insert(tasksCronTable).values({
                            id: row.id,
                            version: row.version ?? 1,
                            validFrom: row.validFrom ?? row.createdAt,
                            validTo: row.validTo ?? null,
                            taskId: row.taskId,
                            userId: row.userId,
                            name: row.name,
                            description: row.description,
                            schedule: row.schedule,
                            timezone: row.timezone,
                            agentId: row.agentId,
                            enabled: row.enabled ? 1 : 0,
                            deleteAfterRun: row.deleteAfterRun ? 1 : 0,
                            parameters: row.parameters ? JSON.stringify(row.parameters) : null,
                            lastRunAt: row.lastRunAt,
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

    async delete(id: string): Promise<boolean> {
        const lock = this.taskLockForId(id);
        return lock.inLock(async () => {
            const current = this.tasksById.get(id) ?? (await this.taskLoadById(id));
            if (!current) {
                return false;
            }

            await this.db
                .update(tasksCronTable)
                .set({ validTo: Date.now() })
                .where(
                    and(
                        eq(tasksCronTable.id, current.id),
                        eq(tasksCronTable.version, current.version ?? 1),
                        isNull(tasksCronTable.validTo)
                    )
                );

            await this.cacheLock.inLock(() => {
                this.tasksById.delete(id);
            });

            return true;
        });
    }

    private taskCacheSet(record: CronTaskDbRecord): void {
        this.tasksById.set(record.id, cronTaskClone(record));
    }

    private async taskLoadById(id: string): Promise<CronTaskDbRecord | null> {
        const rows = await this.db
            .select()
            .from(tasksCronTable)
            .where(and(eq(tasksCronTable.id, id), isNull(tasksCronTable.validTo)))
            .limit(1);
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
        version: row.version ?? 1,
        validFrom: row.validFrom ?? row.createdAt,
        validTo: row.validTo ?? null,
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
    return { ...record, parameters: record.parameters ? structuredClone(record.parameters) : record.parameters };
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

/**
 * Resolves whether the effective update changes only runtime metadata.
 * Expects: `next` is merged from the current record and incoming partial changes.
 */
function cronTaskRuntimeOnlyChangeIs(current: CronTaskDbRecord, next: CronTaskDbRecord): boolean {
    const lastRunAtChanged = (current.lastRunAt ?? null) !== (next.lastRunAt ?? null);
    const updatedAtChanged = current.updatedAt !== next.updatedAt;
    if (!lastRunAtChanged && !updatedAtChanged) {
        return false;
    }

    return (
        current.id === next.id &&
        (current.version ?? 1) === (next.version ?? 1) &&
        (current.validFrom ?? current.createdAt) === (next.validFrom ?? next.createdAt) &&
        (current.validTo ?? null) === (next.validTo ?? null) &&
        current.taskId === next.taskId &&
        current.userId === next.userId &&
        current.name === next.name &&
        current.description === next.description &&
        current.schedule === next.schedule &&
        current.timezone === next.timezone &&
        current.agentId === next.agentId &&
        current.enabled === next.enabled &&
        current.deleteAfterRun === next.deleteAfterRun &&
        cronTaskJsonEqual(current.parameters, next.parameters) &&
        current.createdAt === next.createdAt
    );
}

/**
 * Resolves whether merged state is fully unchanged.
 * Expects: both records are normalized (trimmed task id, normalized timezone).
 */
function cronTaskNoChangesIs(current: CronTaskDbRecord, next: CronTaskDbRecord): boolean {
    return (
        current.id === next.id &&
        (current.version ?? 1) === (next.version ?? 1) &&
        (current.validFrom ?? current.createdAt) === (next.validFrom ?? next.createdAt) &&
        (current.validTo ?? null) === (next.validTo ?? null) &&
        current.taskId === next.taskId &&
        current.userId === next.userId &&
        current.name === next.name &&
        current.description === next.description &&
        current.schedule === next.schedule &&
        current.timezone === next.timezone &&
        current.agentId === next.agentId &&
        current.enabled === next.enabled &&
        current.deleteAfterRun === next.deleteAfterRun &&
        cronTaskJsonEqual(current.parameters, next.parameters) &&
        (current.lastRunAt ?? null) === (next.lastRunAt ?? null) &&
        current.createdAt === next.createdAt &&
        current.updatedAt === next.updatedAt
    );
}

function cronTaskJsonEqual(left: unknown, right: unknown): boolean {
    return JSON.stringify(left) === JSON.stringify(right);
}
