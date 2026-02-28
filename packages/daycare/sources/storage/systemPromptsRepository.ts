import { and, asc, eq, or } from "drizzle-orm";
import type { DaycareDb } from "../schema.js";
import { systemPromptsTable } from "../schema.js";
import { AsyncLock } from "../util/lock.js";
import type { SystemPromptDbRecord, SystemPromptScope } from "./databaseTypes.js";

/**
 * System prompts repository backed by Drizzle with write-through caching.
 * Expects: schema migrations already applied for system_prompts.
 */
export class SystemPromptsRepository {
    private readonly db: DaycareDb;
    private readonly promptsById = new Map<string, SystemPromptDbRecord>();
    private readonly promptLocks = new Map<string, AsyncLock>();
    private readonly cacheLock = new AsyncLock();
    private readonly createLock = new AsyncLock();
    private allLoaded = false;

    constructor(db: DaycareDb) {
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
            const loaded = await this.promptLoadById(id);
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

        const rows = await this.db.select().from(systemPromptsTable).orderBy(asc(systemPromptsTable.createdAt));
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
            const rows = await this.db
                .select()
                .from(systemPromptsTable)
                .where(and(eq(systemPromptsTable.scope, scope), eq(systemPromptsTable.userId, userId)))
                .orderBy(asc(systemPromptsTable.createdAt));
            return rows.map((row) => promptParse(row));
        }
        const rows = await this.db
            .select()
            .from(systemPromptsTable)
            .where(eq(systemPromptsTable.scope, scope))
            .orderBy(asc(systemPromptsTable.createdAt));
        return rows.map((row) => promptParse(row));
    }

    async findEnabled(userId?: string): Promise<SystemPromptDbRecord[]> {
        if (userId) {
            const rows = await this.db
                .select()
                .from(systemPromptsTable)
                .where(
                    and(
                        eq(systemPromptsTable.enabled, 1),
                        or(
                            eq(systemPromptsTable.scope, "global"),
                            and(eq(systemPromptsTable.scope, "user"), eq(systemPromptsTable.userId, userId))
                        )
                    )
                )
                .orderBy(asc(systemPromptsTable.createdAt));
            return rows.map((row) => promptParse(row));
        }
        const rows = await this.db
            .select()
            .from(systemPromptsTable)
            .where(and(eq(systemPromptsTable.enabled, 1), eq(systemPromptsTable.scope, "global")))
            .orderBy(asc(systemPromptsTable.createdAt));
        return rows.map((row) => promptParse(row));
    }

    async create(record: SystemPromptDbRecord): Promise<void> {
        await this.createLock.inLock(async () => {
            await this.db
                .insert(systemPromptsTable)
                .values({
                    id: record.id,
                    scope: record.scope,
                    userId: record.userId,
                    kind: record.kind,
                    condition: record.condition,
                    prompt: record.prompt,
                    enabled: record.enabled ? 1 : 0,
                    createdAt: record.createdAt,
                    updatedAt: record.updatedAt
                })
                .onConflictDoUpdate({
                    target: systemPromptsTable.id,
                    set: {
                        scope: record.scope,
                        userId: record.userId,
                        kind: record.kind,
                        condition: record.condition,
                        prompt: record.prompt,
                        enabled: record.enabled ? 1 : 0,
                        createdAt: record.createdAt,
                        updatedAt: record.updatedAt
                    }
                });

            await this.cacheLock.inLock(() => {
                this.promptCacheSet(record);
            });
        });
    }

    async updateById(id: string, data: Partial<SystemPromptDbRecord>): Promise<void> {
        const lock = this.promptLockForId(id);
        await lock.inLock(async () => {
            const current = this.promptsById.get(id) ?? (await this.promptLoadById(id));
            if (!current) {
                throw new Error(`System prompt not found: ${id}`);
            }

            const next: SystemPromptDbRecord = {
                ...current,
                ...data,
                id: current.id
            };

            await this.db
                .update(systemPromptsTable)
                .set({
                    scope: next.scope,
                    userId: next.userId,
                    kind: next.kind,
                    condition: next.condition,
                    prompt: next.prompt,
                    enabled: next.enabled ? 1 : 0,
                    createdAt: next.createdAt,
                    updatedAt: next.updatedAt
                })
                .where(eq(systemPromptsTable.id, id));

            await this.cacheLock.inLock(() => {
                this.promptCacheSet(next);
            });
        });
    }

    async deleteById(id: string): Promise<boolean> {
        const lock = this.promptLockForId(id);
        return lock.inLock(async () => {
            const result = await this.db
                .delete(systemPromptsTable)
                .where(eq(systemPromptsTable.id, id))
                .returning({ id: systemPromptsTable.id });

            await this.cacheLock.inLock(() => {
                this.promptsById.delete(id);
            });

            return result.length > 0;
        });
    }

    private promptCacheSet(record: SystemPromptDbRecord): void {
        this.promptsById.set(record.id, promptClone(record));
    }

    private async promptLoadById(id: string): Promise<SystemPromptDbRecord | null> {
        const rows = await this.db.select().from(systemPromptsTable).where(eq(systemPromptsTable.id, id)).limit(1);
        const row = rows[0];
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

function promptParse(row: typeof systemPromptsTable.$inferSelect): SystemPromptDbRecord {
    return {
        id: row.id,
        scope: row.scope as SystemPromptDbRecord["scope"],
        userId: row.userId,
        kind: row.kind as SystemPromptDbRecord["kind"],
        condition: row.condition as SystemPromptDbRecord["condition"],
        prompt: row.prompt,
        enabled: row.enabled === 1,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt
    };
}

function promptClone(record: SystemPromptDbRecord): SystemPromptDbRecord {
    return { ...record };
}
