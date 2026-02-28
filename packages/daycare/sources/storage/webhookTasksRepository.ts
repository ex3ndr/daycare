import { and, asc, eq } from "drizzle-orm";
import type { Context } from "@/types";
import type { DaycareDb } from "../schema.js";
import { tasksWebhookTable } from "../schema.js";
import { AsyncLock } from "../util/lock.js";
import type { WebhookTaskDbRecord } from "./databaseTypes.js";

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
            .where(eq(tasksWebhookTable.userId, ctx.userId))
            .orderBy(asc(tasksWebhookTable.updatedAt));
        return rows.map((row) => webhookTaskClone(webhookTaskParse(row)));
    }

    async findAll(): Promise<WebhookTaskDbRecord[]> {
        if (this.allTasksLoaded) {
            return webhookTasksSort(Array.from(this.tasksById.values())).map((task) => webhookTaskClone(task));
        }

        const rows = await this.db.select().from(tasksWebhookTable).orderBy(asc(tasksWebhookTable.updatedAt));
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
            .where(and(eq(tasksWebhookTable.userId, ctx.userId), eq(tasksWebhookTable.taskId, taskId)))
            .orderBy(asc(tasksWebhookTable.updatedAt));
        return rows.map((row) => webhookTaskClone(webhookTaskParse(row)));
    }

    async create(record: WebhookTaskDbRecord): Promise<void> {
        const taskId = record.taskId.trim();
        if (!taskId) {
            throw new Error("Webhook trigger taskId is required.");
        }

        await this.createLock.inLock(async () => {
            await this.db
                .insert(tasksWebhookTable)
                .values({
                    id: record.id,
                    taskId,
                    userId: record.userId,
                    agentId: record.agentId,
                    lastRunAt: record.lastRunAt,
                    createdAt: record.createdAt,
                    updatedAt: record.updatedAt
                })
                .onConflictDoUpdate({
                    target: tasksWebhookTable.id,
                    set: {
                        taskId,
                        userId: record.userId,
                        agentId: record.agentId,
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

    async recordRun(id: string, runAt: number): Promise<void> {
        await this.runLock.inLock(async () => {
            await this.db
                .update(tasksWebhookTable)
                .set({ lastRunAt: runAt, updatedAt: runAt })
                .where(eq(tasksWebhookTable.id, id));
            await this.cacheLock.inLock(() => {
                const cached = this.tasksById.get(id);
                if (!cached) {
                    return;
                }
                this.tasksById.set(id, {
                    ...cached,
                    lastRunAt: runAt,
                    updatedAt: runAt
                });
            });
        });
    }

    async delete(id: string): Promise<boolean> {
        const lock = this.taskLockForId(id);
        return lock.inLock(async () => {
            const result = await this.db
                .delete(tasksWebhookTable)
                .where(eq(tasksWebhookTable.id, id))
                .returning({ id: tasksWebhookTable.id });

            await this.cacheLock.inLock(() => {
                this.tasksById.delete(id);
            });

            return result.length > 0;
        });
    }

    private taskCacheSet(record: WebhookTaskDbRecord): void {
        this.tasksById.set(record.id, webhookTaskClone(record));
    }

    private async taskLoadById(id: string): Promise<WebhookTaskDbRecord | null> {
        const rows = await this.db.select().from(tasksWebhookTable).where(eq(tasksWebhookTable.id, id)).limit(1);
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
