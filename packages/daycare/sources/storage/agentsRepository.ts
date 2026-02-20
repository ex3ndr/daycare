import type { DatabaseSync } from "node:sqlite";
import { AsyncLock } from "../util/lock.js";
import type { AgentDbRecord, DatabaseAgentRow } from "./databaseTypes.js";

/**
 * Agents repository backed by SQLite with write-through caching.
 * Expects: schema migrations already applied for agents.
 */
export class AgentsRepository {
    private readonly db: DatabaseSync;
    private readonly agentsById = new Map<string, AgentDbRecord>();
    private readonly agentLocks = new Map<string, AsyncLock>();
    private readonly cacheLock = new AsyncLock();
    private readonly createLock = new AsyncLock();
    private allAgentsLoaded = false;

    constructor(db: DatabaseSync) {
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
            const row = this.db.prepare("SELECT * FROM agents WHERE id = ? LIMIT 1").get(id) as
                | DatabaseAgentRow
                | undefined;
            if (!row) {
                return null;
            }
            const parsed = this.agentParse(row);
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
        const rows = this.db.prepare("SELECT * FROM agents ORDER BY updated_at ASC").all() as DatabaseAgentRow[];
        const parsed = rows.map((row) => this.agentParse(row));
        await this.cacheLock.inLock(() => {
            this.agentsById.clear();
            for (const entry of parsed) {
                this.agentCacheSet(entry);
            }
            this.allAgentsLoaded = true;
        });
        return parsed.map((entry) => agentClone(entry));
    }

    async create(record: AgentDbRecord): Promise<void> {
        await this.createLock.inLock(async () => {
            this.db
                .prepare(
                    `
                  INSERT INTO agents (
                    id,
                    user_id,
                    type,
                    descriptor,
                    active_session_id,
                    permissions,
                    tokens,
                    stats,
                    lifecycle,
                    created_at,
                    updated_at
                  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                  ON CONFLICT(id) DO UPDATE SET
                    user_id = excluded.user_id,
                    type = excluded.type,
                    descriptor = excluded.descriptor,
                    active_session_id = excluded.active_session_id,
                    permissions = excluded.permissions,
                    tokens = excluded.tokens,
                    stats = excluded.stats,
                    lifecycle = excluded.lifecycle,
                    created_at = excluded.created_at,
                    updated_at = excluded.updated_at
                `
                )
                .run(
                    record.id,
                    record.userId,
                    record.type,
                    JSON.stringify(record.descriptor),
                    record.activeSessionId,
                    JSON.stringify(record.permissions),
                    record.tokens ? JSON.stringify(record.tokens) : null,
                    JSON.stringify(record.stats),
                    record.lifecycle,
                    record.createdAt,
                    record.updatedAt
                );

            await this.cacheLock.inLock(() => {
                this.agentCacheSet(record);
            });
        });
    }

    async update(id: string, data: Partial<AgentDbRecord>): Promise<void> {
        const lock = this.agentLockForId(id);
        await lock.inLock(async () => {
            const current = this.agentsById.get(id) ?? this.agentLoadById(id);
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

            this.db
                .prepare(
                    `
                  UPDATE agents
                  SET
                    user_id = ?,
                    type = ?,
                    descriptor = ?,
                    active_session_id = ?,
                    permissions = ?,
                    tokens = ?,
                    stats = ?,
                    lifecycle = ?,
                    created_at = ?,
                    updated_at = ?
                  WHERE id = ?
                `
                )
                .run(
                    next.userId,
                    next.type,
                    JSON.stringify(next.descriptor),
                    next.activeSessionId,
                    JSON.stringify(next.permissions),
                    next.tokens ? JSON.stringify(next.tokens) : null,
                    JSON.stringify(next.stats),
                    next.lifecycle,
                    next.createdAt,
                    next.updatedAt,
                    id
                );

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

    private agentLoadById(id: string): AgentDbRecord | null {
        const row = this.db.prepare("SELECT * FROM agents WHERE id = ? LIMIT 1").get(id) as
            | DatabaseAgentRow
            | undefined;
        if (!row) {
            return null;
        }
        return this.agentParse(row);
    }

    private agentParse(row: DatabaseAgentRow): AgentDbRecord {
        return {
            id: row.id,
            userId: row.user_id,
            type: row.type,
            descriptor: JSON.parse(row.descriptor) as AgentDbRecord["descriptor"],
            activeSessionId: row.active_session_id,
            permissions: JSON.parse(row.permissions) as AgentDbRecord["permissions"],
            tokens: row.tokens ? (JSON.parse(row.tokens) as NonNullable<AgentDbRecord["tokens"]>) : null,
            stats: JSON.parse(row.stats) as AgentDbRecord["stats"],
            lifecycle: row.lifecycle,
            createdAt: row.created_at,
            updatedAt: row.updated_at
        };
    }
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
