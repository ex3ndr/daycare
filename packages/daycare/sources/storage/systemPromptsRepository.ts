import { and, asc, eq, isNull, or } from "drizzle-orm";
import type { DaycareDb } from "../schema.js";
import { systemPromptsTable } from "../schema.js";
import { AsyncLock } from "../utils/lock.js";
import type { SystemPromptDbRecord, SystemPromptScope } from "./databaseTypes.js";
import { versionAdvance } from "./versionAdvance.js";

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

        const rows = await this.db
            .select()
            .from(systemPromptsTable)
            .where(isNull(systemPromptsTable.validTo))
            .orderBy(asc(systemPromptsTable.createdAt));
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
                .where(
                    and(
                        eq(systemPromptsTable.scope, scope),
                        eq(systemPromptsTable.userId, userId),
                        isNull(systemPromptsTable.validTo)
                    )
                )
                .orderBy(asc(systemPromptsTable.createdAt));
            return rows.map((row) => promptParse(row));
        }
        const rows = await this.db
            .select()
            .from(systemPromptsTable)
            .where(and(eq(systemPromptsTable.scope, scope), isNull(systemPromptsTable.validTo)))
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
                        eq(systemPromptsTable.enabled, true),
                        isNull(systemPromptsTable.validTo),
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
            .where(
                and(
                    eq(systemPromptsTable.enabled, true),
                    eq(systemPromptsTable.scope, "global"),
                    isNull(systemPromptsTable.validTo)
                )
            )
            .orderBy(asc(systemPromptsTable.createdAt));
        return rows.map((row) => promptParse(row));
    }

    async create(record: SystemPromptDbRecord): Promise<void> {
        await this.createLock.inLock(async () => {
            const current = this.promptsById.get(record.id) ?? (await this.promptLoadById(record.id));
            const now = Date.now();
            const next = current
                ? await this.db.transaction(async (tx) =>
                      versionAdvance<SystemPromptDbRecord>({
                          now,
                          changes: {
                              scope: record.scope,
                              userId: record.userId,
                              kind: record.kind,
                              condition: record.condition,
                              prompt: record.prompt,
                              enabled: record.enabled,
                              createdAt: current.createdAt,
                              updatedAt: now
                          },
                          findCurrent: async () => current,
                          closeCurrent: async (row, now) => {
                              const closedRows = await tx
                                  .update(systemPromptsTable)
                                  .set({ validTo: now })
                                  .where(
                                      and(
                                          eq(systemPromptsTable.id, row.id),
                                          eq(systemPromptsTable.version, row.version ?? 1),
                                          isNull(systemPromptsTable.validTo)
                                      )
                                  )
                                  .returning({ version: systemPromptsTable.version });
                              return closedRows.length;
                          },
                          insertNext: async (row) => {
                              await tx.insert(systemPromptsTable).values({
                                  id: row.id,
                                  version: row.version ?? 1,
                                  validFrom: row.validFrom ?? row.createdAt,
                                  validTo: row.validTo ?? null,
                                  scope: row.scope,
                                  userId: row.userId,
                                  kind: row.kind,
                                  condition: row.condition,
                                  prompt: row.prompt,
                                  enabled: row.enabled,
                                  createdAt: row.createdAt,
                                  updatedAt: row.updatedAt
                              });
                          }
                      })
                  )
                : {
                      ...record,
                      version: 1,
                      validFrom: record.createdAt,
                      validTo: null
                  };

            if (!current) {
                await this.db.insert(systemPromptsTable).values({
                    id: next.id,
                    version: next.version ?? 1,
                    validFrom: next.validFrom ?? next.createdAt,
                    validTo: next.validTo ?? null,
                    scope: next.scope,
                    userId: next.userId,
                    kind: next.kind,
                    condition: next.condition,
                    prompt: next.prompt,
                    enabled: next.enabled,
                    createdAt: next.createdAt,
                    updatedAt: next.updatedAt
                });
            }

            await this.cacheLock.inLock(() => {
                this.promptCacheSet(next);
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
            const now = Date.now();

            const next: SystemPromptDbRecord = {
                ...current,
                ...data,
                id: current.id,
                createdAt: current.createdAt,
                updatedAt: now
            };

            const advanced = await this.db.transaction(async (tx) =>
                versionAdvance<SystemPromptDbRecord>({
                    now,
                    changes: {
                        scope: next.scope,
                        userId: next.userId,
                        kind: next.kind,
                        condition: next.condition,
                        prompt: next.prompt,
                        enabled: next.enabled,
                        createdAt: current.createdAt,
                        updatedAt: now
                    },
                    findCurrent: async () => current,
                    closeCurrent: async (row, now) => {
                        const closedRows = await tx
                            .update(systemPromptsTable)
                            .set({ validTo: now })
                            .where(
                                and(
                                    eq(systemPromptsTable.id, row.id),
                                    eq(systemPromptsTable.version, row.version ?? 1),
                                    isNull(systemPromptsTable.validTo)
                                )
                            )
                            .returning({ version: systemPromptsTable.version });
                        return closedRows.length;
                    },
                    insertNext: async (row) => {
                        await tx.insert(systemPromptsTable).values({
                            id: row.id,
                            version: row.version ?? 1,
                            validFrom: row.validFrom ?? row.createdAt,
                            validTo: row.validTo ?? null,
                            scope: row.scope,
                            userId: row.userId,
                            kind: row.kind,
                            condition: row.condition,
                            prompt: row.prompt,
                            enabled: row.enabled,
                            createdAt: row.createdAt,
                            updatedAt: row.updatedAt
                        });
                    }
                })
            );

            await this.cacheLock.inLock(() => {
                this.promptCacheSet(advanced);
            });
        });
    }

    async deleteById(id: string): Promise<boolean> {
        const lock = this.promptLockForId(id);
        return lock.inLock(async () => {
            const current = this.promptsById.get(id) ?? (await this.promptLoadById(id));
            if (!current) {
                return false;
            }
            await this.db
                .update(systemPromptsTable)
                .set({ validTo: Date.now() })
                .where(
                    and(
                        eq(systemPromptsTable.id, current.id),
                        eq(systemPromptsTable.version, current.version ?? 1),
                        isNull(systemPromptsTable.validTo)
                    )
                );

            await this.cacheLock.inLock(() => {
                this.promptsById.delete(id);
            });

            return true;
        });
    }

    private promptCacheSet(record: SystemPromptDbRecord): void {
        this.promptsById.set(record.id, promptClone(record));
    }

    private async promptLoadById(id: string): Promise<SystemPromptDbRecord | null> {
        const rows = await this.db
            .select()
            .from(systemPromptsTable)
            .where(and(eq(systemPromptsTable.id, id), isNull(systemPromptsTable.validTo)))
            .limit(1);
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
        version: row.version ?? 1,
        validFrom: row.validFrom ?? row.createdAt,
        validTo: row.validTo ?? null,
        scope: row.scope as SystemPromptDbRecord["scope"],
        userId: row.userId,
        kind: row.kind as SystemPromptDbRecord["kind"],
        condition: row.condition as SystemPromptDbRecord["condition"],
        prompt: row.prompt,
        enabled: row.enabled,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt
    };
}

function promptClone(record: SystemPromptDbRecord): SystemPromptDbRecord {
    return { ...record };
}
