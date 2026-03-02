import { and, asc, eq, isNull } from "drizzle-orm";
import type { Context } from "@/types";
import { exposeDomainNormalize, exposeTargetParse } from "../engine/expose/exposeTypes.js";
import type { DaycareDb } from "../schema.js";
import { exposeEndpointsTable } from "../schema.js";
import { AsyncLock } from "../utils/lock.js";
import type { ExposeEndpointDbRecord } from "./databaseTypes.js";
import { versionAdvance } from "./versionAdvance.js";

/**
 * Expose endpoints repository backed by Drizzle with write-through caching.
 * Expects: schema migrations already applied for expose_endpoints.
 */
export class ExposeEndpointsRepository {
    private readonly db: DaycareDb;
    private readonly endpointsById = new Map<string, ExposeEndpointDbRecord>();
    private readonly endpointLocks = new Map<string, AsyncLock>();
    private readonly cacheLock = new AsyncLock();
    private readonly createLock = new AsyncLock();
    private allEndpointsLoaded = false;

    constructor(db: DaycareDb) {
        this.db = db;
    }

    async create(record: ExposeEndpointDbRecord): Promise<void> {
        await this.createLock.inLock(async () => {
            const current = this.endpointsById.get(record.id) ?? (await this.endpointLoadById(record.id));
            const now = Date.now();
            const next = current
                ? await this.db.transaction(async (tx) =>
                      versionAdvance<ExposeEndpointDbRecord>({
                          now,
                          changes: {
                              userId: record.userId,
                              target: record.target,
                              provider: record.provider,
                              domain: exposeDomainNormalize(record.domain),
                              mode: record.mode,
                              auth: record.auth,
                              createdAt: current.createdAt,
                              updatedAt: now
                          },
                          findCurrent: async () => current,
                          closeCurrent: async (row, now) => {
                              const closedRows = await tx
                                  .update(exposeEndpointsTable)
                                  .set({ validTo: now })
                                  .where(
                                      and(
                                          eq(exposeEndpointsTable.id, row.id),
                                          eq(exposeEndpointsTable.version, row.version ?? 1),
                                          isNull(exposeEndpointsTable.validTo)
                                      )
                                  )
                                  .returning({ version: exposeEndpointsTable.version });
                              return closedRows.length;
                          },
                          insertNext: async (row) => {
                              await tx.insert(exposeEndpointsTable).values({
                                  id: row.id,
                                  version: row.version ?? 1,
                                  validFrom: row.validFrom ?? row.createdAt,
                                  validTo: row.validTo ?? null,
                                  userId: row.userId,
                                  target: row.target,
                                  provider: row.provider,
                                  domain: exposeDomainNormalize(row.domain),
                                  mode: row.mode,
                                  auth: row.auth,
                                  createdAt: row.createdAt,
                                  updatedAt: row.updatedAt
                              });
                          }
                      })
                  )
                : {
                      ...record,
                      domain: exposeDomainNormalize(record.domain),
                      version: 1,
                      validFrom: record.createdAt,
                      validTo: null
                  };

            if (!current) {
                await this.db.insert(exposeEndpointsTable).values({
                    id: next.id,
                    version: next.version ?? 1,
                    validFrom: next.validFrom ?? next.createdAt,
                    validTo: next.validTo ?? null,
                    userId: next.userId,
                    target: next.target,
                    provider: next.provider,
                    domain: exposeDomainNormalize(next.domain),
                    mode: next.mode,
                    auth: next.auth,
                    createdAt: next.createdAt,
                    updatedAt: next.updatedAt
                });
            }

            await this.cacheLock.inLock(() => {
                this.endpointCacheSet(next);
            });
        });
    }

    async findById(id: string): Promise<ExposeEndpointDbRecord | null> {
        const cached = await this.cacheLock.inLock(() => {
            const existing = this.endpointsById.get(id);
            if (existing) {
                return endpointClone(existing);
            }
            if (this.allEndpointsLoaded) {
                return null;
            }
            return undefined;
        });
        if (cached !== undefined) {
            return cached;
        }

        const lock = this.endpointLockForId(id);
        return lock.inLock(async () => {
            const existing = await this.cacheLock.inLock(() => {
                const item = this.endpointsById.get(id);
                return item ? endpointClone(item) : null;
            });
            if (existing) {
                return existing;
            }
            const loaded = await this.endpointLoadById(id);
            if (!loaded) {
                return null;
            }
            await this.cacheLock.inLock(() => {
                this.endpointCacheSet(loaded);
            });
            return endpointClone(loaded);
        });
    }

    async findMany(ctx: Context): Promise<ExposeEndpointDbRecord[]> {
        const rows = await this.db
            .select()
            .from(exposeEndpointsTable)
            .where(and(eq(exposeEndpointsTable.userId, ctx.userId), isNull(exposeEndpointsTable.validTo)))
            .orderBy(asc(exposeEndpointsTable.createdAt), asc(exposeEndpointsTable.id));
        return rows.map((entry) => endpointClone(endpointParse(entry)));
    }

    async findAll(): Promise<ExposeEndpointDbRecord[]> {
        const cached = await this.cacheLock.inLock(() => {
            if (!this.allEndpointsLoaded) {
                return null;
            }
            return exposeEndpointsSort(Array.from(this.endpointsById.values())).map((entry) => endpointClone(entry));
        });
        if (cached) {
            return cached;
        }

        const rows = await this.db
            .select()
            .from(exposeEndpointsTable)
            .where(isNull(exposeEndpointsTable.validTo))
            .orderBy(asc(exposeEndpointsTable.createdAt), asc(exposeEndpointsTable.id));

        const parsed = rows.map((row) => endpointParse(row));

        await this.cacheLock.inLock(() => {
            for (const entry of parsed) {
                this.endpointCacheSet(entry);
            }
            this.allEndpointsLoaded = true;
        });

        return parsed.map((entry) => endpointClone(entry));
    }

    async update(id: string, data: Partial<ExposeEndpointDbRecord>): Promise<void> {
        const lock = this.endpointLockForId(id);
        await lock.inLock(async () => {
            const cached = await this.cacheLock.inLock(() => this.endpointsById.get(id));
            const current = cached ? endpointClone(cached) : await this.endpointLoadById(id);
            if (!current) {
                throw new Error(`Expose endpoint not found: ${id}`);
            }
            const now = Date.now();

            const next: ExposeEndpointDbRecord = {
                ...current,
                ...data,
                id: current.id,
                userId: data.userId ?? current.userId,
                target: data.target ?? current.target,
                provider: data.provider ?? current.provider,
                domain: data.domain ? exposeDomainNormalize(data.domain) : current.domain,
                mode: data.mode ?? current.mode,
                auth: data.auth === undefined ? current.auth : data.auth,
                createdAt: current.createdAt,
                updatedAt: now
            };

            const advanced = await this.db.transaction(async (tx) =>
                versionAdvance<ExposeEndpointDbRecord>({
                    now,
                    changes: {
                        userId: next.userId,
                        target: next.target,
                        provider: next.provider,
                        domain: next.domain,
                        mode: next.mode,
                        auth: next.auth,
                        createdAt: current.createdAt,
                        updatedAt: now
                    },
                    findCurrent: async () => current,
                    closeCurrent: async (row, now) => {
                        const closedRows = await tx
                            .update(exposeEndpointsTable)
                            .set({ validTo: now })
                            .where(
                                and(
                                    eq(exposeEndpointsTable.id, row.id),
                                    eq(exposeEndpointsTable.version, row.version ?? 1),
                                    isNull(exposeEndpointsTable.validTo)
                                )
                            )
                            .returning({ version: exposeEndpointsTable.version });
                        return closedRows.length;
                    },
                    insertNext: async (row) => {
                        await tx.insert(exposeEndpointsTable).values({
                            id: row.id,
                            version: row.version ?? 1,
                            validFrom: row.validFrom ?? row.createdAt,
                            validTo: row.validTo ?? null,
                            userId: row.userId,
                            target: row.target,
                            provider: row.provider,
                            domain: row.domain,
                            mode: row.mode,
                            auth: row.auth,
                            createdAt: row.createdAt,
                            updatedAt: row.updatedAt
                        });
                    }
                })
            );

            await this.cacheLock.inLock(() => {
                this.endpointCacheSet(advanced);
            });
        });
    }

    async delete(id: string): Promise<boolean> {
        const lock = this.endpointLockForId(id);
        return lock.inLock(async () => {
            const current = this.endpointsById.get(id) ?? (await this.endpointLoadById(id));
            if (!current) {
                return false;
            }
            await this.db
                .update(exposeEndpointsTable)
                .set({ validTo: Date.now() })
                .where(
                    and(
                        eq(exposeEndpointsTable.id, current.id),
                        eq(exposeEndpointsTable.version, current.version ?? 1),
                        isNull(exposeEndpointsTable.validTo)
                    )
                );

            await this.cacheLock.inLock(() => {
                this.endpointsById.delete(id);
            });
            return true;
        });
    }

    private async endpointLoadById(id: string): Promise<ExposeEndpointDbRecord | null> {
        const rows = await this.db
            .select()
            .from(exposeEndpointsTable)
            .where(and(eq(exposeEndpointsTable.id, id), isNull(exposeEndpointsTable.validTo)))
            .limit(1);
        const row = rows[0];
        if (!row) {
            return null;
        }
        return endpointParse(row);
    }

    private endpointCacheSet(record: ExposeEndpointDbRecord): void {
        this.endpointsById.set(record.id, endpointClone(record));
    }

    private endpointLockForId(endpointId: string): AsyncLock {
        const existing = this.endpointLocks.get(endpointId);
        if (existing) {
            return existing;
        }
        const lock = new AsyncLock();
        this.endpointLocks.set(endpointId, lock);
        return lock;
    }
}

function endpointParse(row: typeof exposeEndpointsTable.$inferSelect): ExposeEndpointDbRecord {
    return {
        id: row.id,
        version: row.version ?? 1,
        validFrom: row.validFrom ?? row.createdAt,
        validTo: row.validTo ?? null,
        userId: row.userId,
        target: targetParse(row.target),
        provider: row.provider,
        domain: exposeDomainNormalize(row.domain),
        mode: row.mode as ExposeEndpointDbRecord["mode"],
        auth: authParse(row.auth),
        createdAt: row.createdAt,
        updatedAt: row.updatedAt
    };
}

function targetParse(raw: unknown): ExposeEndpointDbRecord["target"] {
    try {
        return exposeTargetParse(jsonValueParse(raw));
    } catch {
        return { type: "port", port: 80 };
    }
}

function authParse(raw: unknown | null): ExposeEndpointDbRecord["auth"] {
    if (!raw) {
        return null;
    }
    try {
        const parsed = jsonValueParse(raw);
        if (!parsed || typeof parsed !== "object") {
            return null;
        }
        const candidate = parsed as { enabled?: unknown; passwordHash?: unknown };
        if (
            candidate.enabled !== true ||
            typeof candidate.passwordHash !== "string" ||
            !candidate.passwordHash.trim()
        ) {
            return null;
        }
        return {
            enabled: true,
            passwordHash: candidate.passwordHash
        };
    } catch {
        return null;
    }
}

function endpointClone(record: ExposeEndpointDbRecord): ExposeEndpointDbRecord {
    return {
        ...record,
        target: structuredClone(record.target),
        auth: record.auth ? { ...record.auth } : null
    };
}

function exposeEndpointsSort(records: ExposeEndpointDbRecord[]): ExposeEndpointDbRecord[] {
    return records.slice().sort((left, right) => left.createdAt - right.createdAt || left.id.localeCompare(right.id));
}

function jsonValueParse(raw: unknown): unknown {
    if (typeof raw === "string") {
        return JSON.parse(raw);
    }
    return raw;
}
