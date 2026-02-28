import { and, asc, eq, isNull } from "drizzle-orm";
import type { Context } from "@/types";
import type { DaycareDb } from "../schema.js";
import { tasksWebhookTable } from "../schema.js";
import { AsyncLock } from "../util/lock.js";
import type { WebhookTaskDbRecord } from "./databaseTypes.js";
import { versionAdvance } from "./versionAdvance.js";

/**
 * Webhook task repository backed by Drizzle with write-through caching.
 * Expects: schema migrations already applied for tasks_webhook.
 */
export class WebhookTasksRepository {
    private readonly db: DaycareDb;
    private readonly tasksById = new Map<string, WebhookTaskDbRecord>();
    private readonly taskLocks = new Map<string, AsyncLock>();
    private readonly cacheLock = new AsyncLock();
    private readonly createLock = new AsyncLock();
    private readonly runLock = new AsyncLock();
    private allTasksLoaded = false;

    constructor(db: DaycareDb) {
        this.db = db;
    }

    async findById(id: string): Promise<WebhookTaskDbRecord | null> {
        const cached = this.tasksById.get(id);
        if (cached) {
            return webhookTaskClone(cached);
        }
        if (this.allTasksLoaded) {
            return null;
        }

        const lock = this.taskLockForId(id);
        return lock.inLock(async () => {
            const existing = this.tasksById.get(id);
            if (existing) {
                return webhookTaskClone(existing);
            }
            const loaded = await this.taskLoadById(id);
            if (!loaded) {
                return null;
            }
            await this.cacheLock.inLock(() => {
                this.taskCacheSet(loaded);
            });
            return webhookTaskClone(loaded);
        });
    }

    async findMany(ctx: Context): Promise<WebhookTaskDbRecord[]> {
        const rows = await this.db
            .select()
            .from(tasksWebhookTable)
            .where(and(eq(tasksWebhookTable.userId, ctx.userId), isNull(tasksWebhookTable.validTo)))
            .orderBy(asc(tasksWebhookTable.updatedAt));
        return rows.map((row) => webhookTaskClone(webhookTaskParse(row)));
    }

    async findAll(): Promise<WebhookTaskDbRecord[]> {
        if (this.allTasksLoaded) {
            return webhookTasksSort(Array.from(this.tasksById.values())).map((task) => webhookTaskClone(task));
        }

        const rows = await this.db
            .select()
            .from(tasksWebhookTable)
            .where(isNull(tasksWebhookTable.validTo))
            .orderBy(asc(tasksWebhookTable.updatedAt));
        const parsed = rows.map((row) => webhookTaskParse(row));

        await this.cacheLock.inLock(() => {
            this.tasksById.clear();
            for (const task of parsed) {
                this.taskCacheSet(task);
            }
            this.allTasksLoaded = true;
        });

        return parsed.map((task) => webhookTaskClone(task));
    }

    async findManyByTaskId(ctx: Context, taskId: string): Promise<WebhookTaskDbRecord[]> {
        const rows = await this.db
            .select()
            .from(tasksWebhookTable)
            .where(
                and(
                    eq(tasksWebhookTable.userId, ctx.userId),
                    eq(tasksWebhookTable.taskId, taskId),
                    isNull(tasksWebhookTable.validTo)
                )
            )
            .orderBy(asc(tasksWebhookTable.updatedAt));
        return rows.map((row) => webhookTaskClone(webhookTaskParse(row)));
    }

    async create(record: WebhookTaskDbRecord): Promise<void> {
        const taskId = record.taskId.trim();
        if (!taskId) {
            throw new Error("Webhook trigger taskId is required.");
        }

        await this.createLock.inLock(async () => {
            const current = this.tasksById.get(record.id) ?? (await this.taskLoadById(record.id));
            let next: WebhookTaskDbRecord;
            if (!current) {
                next = {
                    ...record,
                    taskId,
                    version: 1,
                    validFrom: record.createdAt,
                    validTo: null
                };
                await this.db.insert(tasksWebhookTable).values({
                    id: next.id,
                    version: next.version ?? 1,
                    validFrom: next.validFrom ?? next.createdAt,
                    validTo: next.validTo ?? null,
                    taskId: next.taskId,
                    userId: next.userId,
                    agentId: next.agentId,
                    lastRunAt: next.lastRunAt,
                    createdAt: next.createdAt,
                    updatedAt: next.updatedAt
                });
            } else {
                next = await versionAdvance<WebhookTaskDbRecord>({
                    changes: {
                        taskId,
                        userId: record.userId,
                        agentId: record.agentId,
                        lastRunAt: record.lastRunAt,
                        createdAt: record.createdAt,
                        updatedAt: record.updatedAt
                    },
                    findCurrent: async () => current,
                    closeCurrent: async (row, now) => {
                        await this.db
                            .update(tasksWebhookTable)
                            .set({ validTo: now })
                            .where(
                                and(
                                    eq(tasksWebhookTable.id, row.id),
                                    eq(tasksWebhookTable.version, row.version ?? 1),
                                    isNull(tasksWebhookTable.validTo)
                                )
                            );
                    },
                    insertNext: async (row) => {
                        await this.db.insert(tasksWebhookTable).values({
                            id: row.id,
                            version: row.version ?? 1,
                            validFrom: row.validFrom ?? row.createdAt,
                            validTo: row.validTo ?? null,
                            taskId: row.taskId,
                            userId: row.userId,
                            agentId: row.agentId,
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

    async recordRun(id: string, runAt: number): Promise<void> {
        await this.runLock.inLock(async () => {
            const current = this.tasksById.get(id) ?? (await this.taskLoadById(id));
            if (!current) {
                return;
            }

            const next = await versionAdvance<WebhookTaskDbRecord>({
                now: runAt,
                changes: { lastRunAt: runAt, updatedAt: runAt },
                findCurrent: async () => current,
                closeCurrent: async (row, now) => {
                    await this.db
                        .update(tasksWebhookTable)
                        .set({ validTo: now })
                        .where(
                            and(
                                eq(tasksWebhookTable.id, row.id),
                                eq(tasksWebhookTable.version, row.version ?? 1),
                                isNull(tasksWebhookTable.validTo)
                            )
                        );
                },
                insertNext: async (row) => {
                    await this.db.insert(tasksWebhookTable).values({
                        id: row.id,
                        version: row.version ?? 1,
                        validFrom: row.validFrom ?? row.createdAt,
                        validTo: row.validTo ?? null,
                        taskId: row.taskId,
                        userId: row.userId,
                        agentId: row.agentId,
                        lastRunAt: row.lastRunAt,
                        createdAt: row.createdAt,
                        updatedAt: row.updatedAt
                    });
                }
            });

            await this.cacheLock.inLock(() => {
                this.taskCacheSet(next);
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
                .update(tasksWebhookTable)
                .set({ validTo: Date.now() })
                .where(
                    and(
                        eq(tasksWebhookTable.id, current.id),
                        eq(tasksWebhookTable.version, current.version ?? 1),
                        isNull(tasksWebhookTable.validTo)
                    )
                );

            await this.cacheLock.inLock(() => {
                this.tasksById.delete(id);
            });

            return true;
        });
    }

    private taskCacheSet(record: WebhookTaskDbRecord): void {
        this.tasksById.set(record.id, webhookTaskClone(record));
    }

    private async taskLoadById(id: string): Promise<WebhookTaskDbRecord | null> {
        const rows = await this.db
            .select()
            .from(tasksWebhookTable)
            .where(and(eq(tasksWebhookTable.id, id), isNull(tasksWebhookTable.validTo)))
            .limit(1);
        const row = rows[0];
        if (!row) {
            return null;
        }
        return webhookTaskParse(row);
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

function webhookTaskParse(row: typeof tasksWebhookTable.$inferSelect): WebhookTaskDbRecord {
    const taskId = row.taskId?.trim();
    if (!taskId) {
        throw new Error(`Webhook trigger ${row.id} is missing required task_id.`);
    }
    return {
        id: row.id,
        version: row.version ?? 1,
        validFrom: row.validFrom ?? row.createdAt,
        validTo: row.validTo ?? null,
        taskId,
        userId: row.userId,
        agentId: row.agentId,
        lastRunAt: row.lastRunAt,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt
    };
}

function webhookTaskClone(record: WebhookTaskDbRecord): WebhookTaskDbRecord {
    return { ...record };
}

function webhookTasksSort(records: WebhookTaskDbRecord[]): WebhookTaskDbRecord[] {
    return records.slice().sort((left, right) => left.updatedAt - right.updatedAt);
}
