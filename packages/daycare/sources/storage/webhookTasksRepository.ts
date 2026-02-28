import type { Context } from "@/types";
import { AsyncLock } from "../util/lock.js";
import type { StorageDatabase } from "./databaseOpen.js";
import type { DatabaseWebhookTaskRow, WebhookTaskDbRecord } from "./databaseTypes.js";

/**
 * Webhook task repository backed by SQLite with write-through caching.
 * Expects: schema migrations already applied for tasks_webhook.
 */
export class WebhookTasksRepository {
    private readonly db: StorageDatabase;
    private readonly tasksById = new Map<string, WebhookTaskDbRecord>();
    private readonly taskLocks = new Map<string, AsyncLock>();
    private readonly cacheLock = new AsyncLock();
    private readonly createLock = new AsyncLock();
    private allTasksLoaded = false;

    constructor(db: StorageDatabase) {
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
        const rows = (await this.db
            .prepare("SELECT * FROM tasks_webhook WHERE user_id = ? ORDER BY updated_at ASC")
            .all(ctx.userId)) as DatabaseWebhookTaskRow[];
        return rows.map((row) => webhookTaskClone(this.taskParse(row)));
    }

    async findAll(): Promise<WebhookTaskDbRecord[]> {
        if (this.allTasksLoaded) {
            return webhookTasksSort(Array.from(this.tasksById.values())).map((task) => webhookTaskClone(task));
        }

        const rows = (await this.db
            .prepare("SELECT * FROM tasks_webhook ORDER BY updated_at ASC")
            .all()) as DatabaseWebhookTaskRow[];
        const parsed = rows.map((row) => this.taskParse(row));

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
        const rows = (await this.db
            .prepare("SELECT * FROM tasks_webhook WHERE user_id = ? AND task_id = ? ORDER BY updated_at ASC")
            .all(ctx.userId, taskId)) as DatabaseWebhookTaskRow[];
        return rows.map((row) => webhookTaskClone(this.taskParse(row)));
    }

    async create(record: WebhookTaskDbRecord): Promise<void> {
        const taskId = record.taskId.trim();
        if (!taskId) {
            throw new Error("Webhook trigger taskId is required.");
        }

        await this.createLock.inLock(async () => {
            await this.db
                .prepare(
                    `
                  INSERT INTO tasks_webhook (
                    id,
                    task_id,
                    user_id,
                    agent_id,
                    created_at,
                    updated_at
                  ) VALUES (?, ?, ?, ?, ?, ?)
                  ON CONFLICT(id) DO UPDATE SET
                    task_id = excluded.task_id,
                    user_id = excluded.user_id,
                    agent_id = excluded.agent_id,
                    created_at = excluded.created_at,
                    updated_at = excluded.updated_at
                `
                )
                .run(record.id, taskId, record.userId, record.agentId, record.createdAt, record.updatedAt);

            await this.cacheLock.inLock(() => {
                this.taskCacheSet(record);
            });
        });
    }

    async delete(id: string): Promise<boolean> {
        const lock = this.taskLockForId(id);
        return lock.inLock(async () => {
            const removed = await this.db.prepare("DELETE FROM tasks_webhook WHERE id = ?").run(id);
            const rawChanges = (removed as { changes?: number | bigint }).changes;
            const changes = typeof rawChanges === "bigint" ? Number(rawChanges) : (rawChanges ?? 0);

            await this.cacheLock.inLock(() => {
                this.tasksById.delete(id);
            });

            return changes > 0;
        });
    }

    private taskCacheSet(record: WebhookTaskDbRecord): void {
        this.tasksById.set(record.id, webhookTaskClone(record));
    }

    private async taskLoadById(id: string): Promise<WebhookTaskDbRecord | null> {
        const row = (await this.db.prepare("SELECT * FROM tasks_webhook WHERE id = ? LIMIT 1").get(id)) as
            | DatabaseWebhookTaskRow
            | undefined;
        if (!row) {
            return null;
        }
        return this.taskParse(row);
    }

    private taskParse(row: DatabaseWebhookTaskRow): WebhookTaskDbRecord {
        const taskId = row.task_id?.trim();
        if (!taskId) {
            throw new Error(`Webhook trigger ${row.id} is missing required task_id.`);
        }
        return {
            id: row.id,
            taskId,
            userId: row.user_id,
            agentId: row.agent_id,
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

function webhookTaskClone(record: WebhookTaskDbRecord): WebhookTaskDbRecord {
    return { ...record };
}

function webhookTasksSort(records: WebhookTaskDbRecord[]): WebhookTaskDbRecord[] {
    return records.slice().sort((left, right) => left.updatedAt - right.updatedAt);
}
