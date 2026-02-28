import { asc, eq } from "drizzle-orm";
import type { DaycareDb } from "../schema.js";
import { agentsTable } from "../schema.js";
import { AsyncLock } from "../util/lock.js";
import type { AgentDbRecord } from "./databaseTypes.js";

/**
 * Agents repository backed by Drizzle with write-through caching.
 * Expects: schema migrations already applied for agents.
 */
export class AgentsRepository {
    private readonly db: DaycareDb;
    private readonly agentsById = new Map<string, AgentDbRecord>();
    private readonly agentLocks = new Map<string, AsyncLock>();
    private readonly cacheLock = new AsyncLock();
    private readonly createLock = new AsyncLock();
    private allAgentsLoaded = false;

    constructor(db: DaycareDb) {
        this.db = db;
    }

    async findById(id: string): Promise<AgentDbRecord | null> {
        const cached = this.agentsById.get(id);
        if (cached) {
            return agentClone(cached);
        }

        const lock = this.agentLockForId(id);
        return lock.inLock(async () => {
            const existing = this.agentsById.get(id);
            if (existing) {
                return agentClone(existing);
            }
            const rows = await this.db.select().from(agentsTable).where(eq(agentsTable.id, id)).limit(1);
            const row = rows[0];
            if (!row) {
                return null;
            }
            const parsed = agentParse(row);
            await this.cacheLock.inLock(() => {
                this.agentCacheSet(parsed);
            });
            return agentClone(parsed);
        });
    }

    async findMany(): Promise<AgentDbRecord[]> {
        if (this.allAgentsLoaded) {
            return agentsSort(Array.from(this.agentsById.values())).map((record) => agentClone(record));
        }
        const rows = await this.db.select().from(agentsTable).orderBy(asc(agentsTable.updatedAt));
        const parsed = rows.map((row) => agentParse(row));
        await this.cacheLock.inLock(() => {
            this.agentsById.clear();
            for (const entry of parsed) {
                this.agentCacheSet(entry);
            }
            this.allAgentsLoaded = true;
        });
        return parsed.map((entry) => agentClone(entry));
    }

    async findByUserId(userId: string): Promise<AgentDbRecord[]> {
        if (this.allAgentsLoaded) {
            const filtered = Array.from(this.agentsById.values()).filter((record) => record.userId === userId);
            return agentsSort(filtered).map((record) => agentClone(record));
        }

        const rows = await this.db
            .select()
            .from(agentsTable)
            .where(eq(agentsTable.userId, userId))
            .orderBy(asc(agentsTable.updatedAt));
        const parsed = rows.map((row) => agentParse(row));

        await this.cacheLock.inLock(() => {
            for (const record of parsed) {
                this.agentCacheSet(record);
            }
        });

        return parsed.map((record) => agentClone(record));
    }

    async create(record: AgentDbRecord): Promise<void> {
        await this.createLock.inLock(async () => {
            await this.db
                .insert(agentsTable)
                .values({
                    id: record.id,
                    userId: record.userId,
                    type: record.type,
                    descriptor: JSON.stringify(record.descriptor),
                    activeSessionId: record.activeSessionId,
                    permissions: JSON.stringify(record.permissions),
                    tokens: record.tokens ? JSON.stringify(record.tokens) : null,
                    stats: JSON.stringify(record.stats),
                    lifecycle: record.lifecycle,
                    createdAt: record.createdAt,
                    updatedAt: record.updatedAt
                })
                .onConflictDoUpdate({
                    target: agentsTable.id,
                    set: {
                        userId: record.userId,
                        type: record.type,
                        descriptor: JSON.stringify(record.descriptor),
                        activeSessionId: record.activeSessionId,
                        permissions: JSON.stringify(record.permissions),
                        tokens: record.tokens ? JSON.stringify(record.tokens) : null,
                        stats: JSON.stringify(record.stats),
                        lifecycle: record.lifecycle,
                        createdAt: record.createdAt,
                        updatedAt: record.updatedAt
                    }
                });

            await this.cacheLock.inLock(() => {
                this.agentCacheSet(record);
            });
        });
    }

    async update(id: string, data: Partial<AgentDbRecord>): Promise<void> {
        const lock = this.agentLockForId(id);
        await lock.inLock(async () => {
            const current = this.agentsById.get(id) ?? (await this.agentLoadById(id));
            if (!current) {
                throw new Error(`Agent not found: ${id}`);
            }
            const next: AgentDbRecord = {
                ...current,
                ...data,
                id: current.id,
                descriptor: data.descriptor ?? current.descriptor,
                permissions: data.permissions ?? current.permissions,
                stats: data.stats ?? current.stats,
                tokens: data.tokens === undefined ? current.tokens : data.tokens
            };

            await this.db
                .update(agentsTable)
                .set({
                    userId: next.userId,
                    type: next.type,
                    descriptor: JSON.stringify(next.descriptor),
                    activeSessionId: next.activeSessionId,
                    permissions: JSON.stringify(next.permissions),
                    tokens: next.tokens ? JSON.stringify(next.tokens) : null,
                    stats: JSON.stringify(next.stats),
                    lifecycle: next.lifecycle,
                    createdAt: next.createdAt,
                    updatedAt: next.updatedAt
                })
                .where(eq(agentsTable.id, id));

            await this.cacheLock.inLock(() => {
                this.agentCacheSet(next);
            });
        });
    }

    async invalidate(id: string): Promise<void> {
        await this.cacheLock.inLock(() => {
            this.agentsById.delete(id);
            this.allAgentsLoaded = false;
        });
    }

    private agentLockForId(agentId: string): AsyncLock {
        const existing = this.agentLocks.get(agentId);
        if (existing) {
            return existing;
        }
        const lock = new AsyncLock();
        this.agentLocks.set(agentId, lock);
        return lock;
    }

    private agentCacheSet(record: AgentDbRecord): void {
        this.agentsById.set(record.id, agentClone(record));
    }

    private async agentLoadById(id: string): Promise<AgentDbRecord | null> {
        const rows = await this.db.select().from(agentsTable).where(eq(agentsTable.id, id)).limit(1);
        const row = rows[0];
        if (!row) {
            return null;
        }
        return agentParse(row);
    }
}

function agentParse(row: typeof agentsTable.$inferSelect): AgentDbRecord {
    return {
        id: row.id,
        userId: row.userId,
        type: row.type as AgentDbRecord["type"],
        descriptor: JSON.parse(row.descriptor) as AgentDbRecord["descriptor"],
        activeSessionId: row.activeSessionId,
        permissions: JSON.parse(row.permissions) as AgentDbRecord["permissions"],
        tokens: row.tokens ? (JSON.parse(row.tokens) as NonNullable<AgentDbRecord["tokens"]>) : null,
        stats: JSON.parse(row.stats) as AgentDbRecord["stats"],
        lifecycle: row.lifecycle as AgentDbRecord["lifecycle"],
        createdAt: row.createdAt,
        updatedAt: row.updatedAt
    };
}

function agentClone(record: AgentDbRecord): AgentDbRecord {
    return {
        ...record,
        descriptor: JSON.parse(JSON.stringify(record.descriptor)) as AgentDbRecord["descriptor"],
        permissions: JSON.parse(JSON.stringify(record.permissions)) as AgentDbRecord["permissions"],
        stats: JSON.parse(JSON.stringify(record.stats)) as AgentDbRecord["stats"],
        tokens: record.tokens ? (JSON.parse(JSON.stringify(record.tokens)) as AgentDbRecord["tokens"]) : null
    };
}

function agentsSort(records: AgentDbRecord[]): AgentDbRecord[] {
    return records.slice().sort((left, right) => left.updatedAt - right.updatedAt);
}
