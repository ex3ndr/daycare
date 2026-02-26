import type { Context } from "@/types";
import { exposeDomainNormalize, exposeTargetParse } from "../engine/expose/exposeTypes.js";
import { AsyncLock } from "../util/lock.js";
import type { StorageDatabase } from "./databaseOpen.js";
import type { DatabaseExposeEndpointRow, ExposeEndpointDbRecord } from "./databaseTypes.js";

/**
 * Expose endpoints repository backed by SQLite with write-through caching.
 * Expects: schema migrations already applied for expose_endpoints.
 */
export class ExposeEndpointsRepository {
    private readonly db: StorageDatabase;
    private readonly endpointsById = new Map<string, ExposeEndpointDbRecord>();
    private readonly endpointLocks = new Map<string, AsyncLock>();
    private readonly cacheLock = new AsyncLock();
    private readonly createLock = new AsyncLock();
    private allEndpointsLoaded = false;

    constructor(db: StorageDatabase) {
        this.db = db;
    }

    async create(record: ExposeEndpointDbRecord): Promise<void> {
        await this.createLock.inLock(async () => {
            await this.db
                .prepare(
                    `
                  INSERT INTO expose_endpoints (
                    id,
                    user_id,
                    target,
                    provider,
                    domain,
                    mode,
                    auth,
                    created_at,
                    updated_at
                  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                  ON CONFLICT(id) DO UPDATE SET
                    user_id = excluded.user_id,
                    target = excluded.target,
                    provider = excluded.provider,
                    domain = excluded.domain,
                    mode = excluded.mode,
                    auth = excluded.auth,
                    created_at = excluded.created_at,
                    updated_at = excluded.updated_at
                `
                )
                .run(
                    record.id,
                    record.userId,
                    JSON.stringify(record.target),
                    record.provider,
                    exposeDomainNormalize(record.domain),
                    record.mode,
                    record.auth ? JSON.stringify(record.auth) : null,
                    record.createdAt,
                    record.updatedAt
                );

            await this.cacheLock.inLock(() => {
                this.endpointCacheSet(record);
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
            .prepare("SELECT * FROM expose_endpoints WHERE user_id = ? ORDER BY created_at ASC, id ASC")
            .all(ctx.userId) as DatabaseExposeEndpointRow[];
        return rows.map((entry) => endpointClone(this.endpointParse(entry)));
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
            .prepare("SELECT * FROM expose_endpoints ORDER BY created_at ASC, id ASC")
            .all() as DatabaseExposeEndpointRow[];

        const parsed = rows.map((row) => this.endpointParse(row));

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
                createdAt: data.createdAt ?? current.createdAt,
                updatedAt: data.updatedAt ?? current.updatedAt
            };

            await this.db
                .prepare(
                    `
                  UPDATE expose_endpoints
                  SET
                    user_id = ?,
                    target = ?,
                    provider = ?,
                    domain = ?,
                    mode = ?,
                    auth = ?,
                    created_at = ?,
                    updated_at = ?
                  WHERE id = ?
                `
                )
                .run(
                    next.userId,
                    JSON.stringify(next.target),
                    next.provider,
                    next.domain,
                    next.mode,
                    next.auth ? JSON.stringify(next.auth) : null,
                    next.createdAt,
                    next.updatedAt,
                    id
                );

            await this.cacheLock.inLock(() => {
                this.endpointCacheSet(next);
            });
        });
    }

    async delete(id: string): Promise<boolean> {
        const lock = this.endpointLockForId(id);
        return lock.inLock(async () => {
            const removed = await this.db.prepare("DELETE FROM expose_endpoints WHERE id = ?").run(id);
            const rawChanges = (removed as { changes?: number | bigint }).changes;
            const changes = typeof rawChanges === "bigint" ? Number(rawChanges) : (rawChanges ?? 0);

            await this.cacheLock.inLock(() => {
                this.endpointsById.delete(id);
            });
            return changes > 0;
        });
    }

    private async endpointLoadById(id: string): Promise<ExposeEndpointDbRecord | null> {
        const row = await this.db.prepare("SELECT * FROM expose_endpoints WHERE id = ? LIMIT 1").get(id) as
            | DatabaseExposeEndpointRow
            | undefined;
        if (!row) {
            return null;
        }
        return this.endpointParse(row);
    }

    private endpointParse(row: DatabaseExposeEndpointRow): ExposeEndpointDbRecord {
        return {
            id: row.id,
            userId: row.user_id,
            target: targetParse(row.target),
            provider: row.provider,
            domain: exposeDomainNormalize(row.domain),
            mode: row.mode,
            auth: authParse(row.auth),
            createdAt: row.created_at,
            updatedAt: row.updated_at
        };
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

function targetParse(raw: string): ExposeEndpointDbRecord["target"] {
    try {
        return exposeTargetParse(JSON.parse(raw));
    } catch {
        return { type: "port", port: 80 };
    }
}

function authParse(raw: string | null): ExposeEndpointDbRecord["auth"] {
    if (!raw) {
        return null;
    }
    try {
        const parsed = JSON.parse(raw) as unknown;
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
        target: JSON.parse(JSON.stringify(record.target)) as ExposeEndpointDbRecord["target"],
        auth: record.auth ? { ...record.auth } : null
    };
}

function exposeEndpointsSort(records: ExposeEndpointDbRecord[]): ExposeEndpointDbRecord[] {
    return records.slice().sort((left, right) => left.createdAt - right.createdAt || left.id.localeCompare(right.id));
}
