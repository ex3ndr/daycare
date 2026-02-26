import { AsyncLock } from "../util/lock.js";
import type { StorageDatabase } from "./databaseOpen.js";
import type { DatabaseSystemPromptRow, SystemPromptDbRecord, SystemPromptScope } from "./databaseTypes.js";

/**
 * System prompts repository backed by SQLite with write-through caching.
 * Expects: schema migrations already applied for system_prompts.
 */
export class SystemPromptsRepository {
    private readonly db: StorageDatabase;
    private readonly promptsById = new Map<string, SystemPromptDbRecord>();
    private readonly promptLocks = new Map<string, AsyncLock>();
    private readonly cacheLock = new AsyncLock();
    private readonly createLock = new AsyncLock();
    private allLoaded = false;

    constructor(db: StorageDatabase) {
        this.db = db;
    }

    async findById(id: string): Promise<SystemPromptDbRecord | null> {
        const cached = this.promptsById.get(id);
        if (cached) {
            return promptClone(cached);
        }
        if (this.allLoaded) {
            return null;
        }

        const lock = this.promptLockForId(id);
        return lock.inLock(async () => {
            const existing = this.promptsById.get(id);
            if (existing) {
                return promptClone(existing);
            }
            const loaded = this.promptLoadById(id);
            if (!loaded) {
                return null;
            }
            await this.cacheLock.inLock(() => {
                this.promptCacheSet(loaded);
            });
            return promptClone(loaded);
        });
    }

    async findMany(): Promise<SystemPromptDbRecord[]> {
        if (this.allLoaded) {
            return Array.from(this.promptsById.values()).map((p) => promptClone(p));
        }

        const rows = this.db
            .prepare("SELECT * FROM system_prompts ORDER BY created_at ASC")
            .all() as DatabaseSystemPromptRow[];
        const parsed = rows.map((row) => promptParse(row));

        await this.cacheLock.inLock(() => {
            this.promptsById.clear();
            for (const prompt of parsed) {
                this.promptCacheSet(prompt);
            }
            this.allLoaded = true;
        });

        return parsed.map((p) => promptClone(p));
    }

    async findByScope(scope: SystemPromptScope, userId?: string): Promise<SystemPromptDbRecord[]> {
        if (scope === "user" && userId) {
            const rows = this.db
                .prepare("SELECT * FROM system_prompts WHERE scope = ? AND user_id = ? ORDER BY created_at ASC")
                .all(scope, userId) as DatabaseSystemPromptRow[];
            return rows.map((row) => promptParse(row));
        }
        const rows = this.db
            .prepare("SELECT * FROM system_prompts WHERE scope = ? ORDER BY created_at ASC")
            .all(scope) as DatabaseSystemPromptRow[];
        return rows.map((row) => promptParse(row));
    }

    async findEnabled(userId?: string): Promise<SystemPromptDbRecord[]> {
        if (userId) {
            const rows = this.db
                .prepare(
                    "SELECT * FROM system_prompts WHERE enabled = 1 AND (scope = 'global' OR (scope = 'user' AND user_id = ?)) ORDER BY created_at ASC"
                )
                .all(userId) as DatabaseSystemPromptRow[];
            return rows.map((row) => promptParse(row));
        }
        const rows = this.db
            .prepare("SELECT * FROM system_prompts WHERE enabled = 1 AND scope = 'global' ORDER BY created_at ASC")
            .all() as DatabaseSystemPromptRow[];
        return rows.map((row) => promptParse(row));
    }

    async create(record: SystemPromptDbRecord): Promise<void> {
        await this.createLock.inLock(async () => {
            this.db
                .prepare(
                    `
                INSERT INTO system_prompts (id, scope, user_id, kind, condition, prompt, enabled, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                    scope = excluded.scope,
                    user_id = excluded.user_id,
                    kind = excluded.kind,
                    condition = excluded.condition,
                    prompt = excluded.prompt,
                    enabled = excluded.enabled,
                    created_at = excluded.created_at,
                    updated_at = excluded.updated_at
                `
                )
                .run(
                    record.id,
                    record.scope,
                    record.userId,
                    record.kind,
                    record.condition,
                    record.prompt,
                    record.enabled ? 1 : 0,
                    record.createdAt,
                    record.updatedAt
                );

            await this.cacheLock.inLock(() => {
                this.promptCacheSet(record);
            });
        });
    }

    async updateById(id: string, data: Partial<SystemPromptDbRecord>): Promise<void> {
        const lock = this.promptLockForId(id);
        await lock.inLock(async () => {
            const current = this.promptsById.get(id) ?? this.promptLoadById(id);
            if (!current) {
                throw new Error(`System prompt not found: ${id}`);
            }

            const next: SystemPromptDbRecord = {
                ...current,
                ...data,
                id: current.id
            };

            this.db
                .prepare(
                    `
                UPDATE system_prompts
                SET scope = ?, user_id = ?, kind = ?, condition = ?, prompt = ?, enabled = ?, created_at = ?, updated_at = ?
                WHERE id = ?
                `
                )
                .run(
                    next.scope,
                    next.userId,
                    next.kind,
                    next.condition,
                    next.prompt,
                    next.enabled ? 1 : 0,
                    next.createdAt,
                    next.updatedAt,
                    id
                );

            await this.cacheLock.inLock(() => {
                this.promptCacheSet(next);
            });
        });
    }

    async deleteById(id: string): Promise<boolean> {
        const lock = this.promptLockForId(id);
        return lock.inLock(async () => {
            const removed = this.db.prepare("DELETE FROM system_prompts WHERE id = ?").run(id);
            const rawChanges = (removed as { changes?: number | bigint }).changes;
            const changes = typeof rawChanges === "bigint" ? Number(rawChanges) : (rawChanges ?? 0);

            await this.cacheLock.inLock(() => {
                this.promptsById.delete(id);
            });

            return changes > 0;
        });
    }

    private promptCacheSet(record: SystemPromptDbRecord): void {
        this.promptsById.set(record.id, promptClone(record));
    }

    private promptLoadById(id: string): SystemPromptDbRecord | null {
        const row = this.db.prepare("SELECT * FROM system_prompts WHERE id = ? LIMIT 1").get(id) as
            | DatabaseSystemPromptRow
            | undefined;
        if (!row) {
            return null;
        }
        return promptParse(row);
    }

    private promptLockForId(id: string): AsyncLock {
        const existing = this.promptLocks.get(id);
        if (existing) {
            return existing;
        }
        const lock = new AsyncLock();
        this.promptLocks.set(id, lock);
        return lock;
    }
}

function promptParse(row: DatabaseSystemPromptRow): SystemPromptDbRecord {
    return {
        id: row.id,
        scope: row.scope,
        userId: row.user_id,
        kind: row.kind,
        condition: row.condition as SystemPromptDbRecord["condition"],
        prompt: row.prompt,
        enabled: row.enabled === 1,
        createdAt: row.created_at,
        updatedAt: row.updated_at
    };
}

function promptClone(record: SystemPromptDbRecord): SystemPromptDbRecord {
    return { ...record };
}
