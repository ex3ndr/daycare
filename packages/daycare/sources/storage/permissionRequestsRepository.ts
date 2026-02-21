import type { DatabaseSync } from "node:sqlite";
import type { PermissionDecision, PermissionRequest, PermissionRequestScope } from "@/types";
import { AsyncLock } from "../util/lock.js";
import type { DatabasePermissionRequestRow } from "./databaseTypes.js";

export type PermissionRequestStatus = "pending" | "approved" | "denied" | "expired";

export type PermissionRequestDbRecord = {
    id: string;
    token: string;
    agentId: string;
    userId: string;
    status: PermissionRequestStatus;
    permissions: PermissionRequest["permissions"];
    reason: string;
    requester: PermissionRequest["requester"];
    scope: PermissionRequestScope | null;
    timeoutAt: number;
    decision: PermissionDecision | null;
    createdAt: number;
    updatedAt: number;
};

/**
 * Permission requests repository backed by SQLite with write-through caching.
 * Expects: schema migrations already applied for permission_requests.
 */
export class PermissionRequestsRepository {
    private readonly db: DatabaseSync;
    private readonly recordsById = new Map<string, PermissionRequestDbRecord>();
    private readonly recordIdsByToken = new Map<string, string>();
    private readonly tokenLocks = new Map<string, AsyncLock>();
    private readonly cacheLock = new AsyncLock();
    private readonly createLock = new AsyncLock();
    private readonly expireLock = new AsyncLock();
    private allRecordsLoaded = false;

    constructor(db: DatabaseSync) {
        this.db = db;
    }

    async create(record: PermissionRequestDbRecord): Promise<void> {
        await this.createLock.inLock(async () => {
            this.db
                .prepare(
                    `
                  INSERT INTO permission_requests (
                    id,
                    token,
                    agent_id,
                    user_id,
                    status,
                    permissions,
                    reason,
                    requester,
                    scope,
                    timeout_at,
                    decision,
                    created_at,
                    updated_at
                  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                  ON CONFLICT(id) DO UPDATE SET
                    token = excluded.token,
                    agent_id = excluded.agent_id,
                    user_id = excluded.user_id,
                    status = excluded.status,
                    permissions = excluded.permissions,
                    reason = excluded.reason,
                    requester = excluded.requester,
                    scope = excluded.scope,
                    timeout_at = excluded.timeout_at,
                    decision = excluded.decision,
                    created_at = excluded.created_at,
                    updated_at = excluded.updated_at
                `
                )
                .run(
                    record.id,
                    record.token,
                    record.agentId,
                    record.userId,
                    record.status,
                    JSON.stringify(record.permissions),
                    record.reason,
                    JSON.stringify(record.requester),
                    record.scope,
                    record.timeoutAt,
                    record.decision ? JSON.stringify(record.decision) : null,
                    record.createdAt,
                    record.updatedAt
                );

            await this.cacheLock.inLock(() => {
                this.recordCacheSet(record);
            });
        });
    }

    async findByToken(token: string): Promise<PermissionRequestDbRecord | null> {
        const normalizedToken = token.trim();
        if (!normalizedToken) {
            return null;
        }

        const cached = await this.cacheLock.inLock(() => {
            const existingId = this.recordIdsByToken.get(normalizedToken);
            if (existingId) {
                const existing = this.recordsById.get(existingId);
                return existing ? permissionRequestClone(existing) : null;
            }
            if (this.allRecordsLoaded) {
                return null;
            }
            return undefined;
        });
        if (cached !== undefined) {
            return cached;
        }

        const lock = this.recordLockForToken(normalizedToken);
        return lock.inLock(async () => {
            const existing = await this.cacheLock.inLock(() => {
                const existingId = this.recordIdsByToken.get(normalizedToken);
                if (!existingId) {
                    return null;
                }
                const record = this.recordsById.get(existingId);
                return record ? permissionRequestClone(record) : null;
            });
            if (existing) {
                return existing;
            }
            const loaded = this.recordLoadByToken(normalizedToken);
            if (!loaded) {
                return null;
            }
            await this.cacheLock.inLock(() => {
                this.recordCacheSet(loaded);
            });
            return permissionRequestClone(loaded);
        });
    }

    async findPendingByAgentId(agentId: string): Promise<PermissionRequestDbRecord[]> {
        const normalizedAgentId = agentId.trim();
        if (!normalizedAgentId) {
            return [];
        }

        const cached = await this.cacheLock.inLock(() => {
            if (!this.allRecordsLoaded) {
                return null;
            }
            return permissionRequestsSort(
                Array.from(this.recordsById.values()).filter(
                    (entry) => entry.agentId === normalizedAgentId && entry.status === "pending"
                )
            );
        });
        if (cached) {
            return cached.map((entry) => permissionRequestClone(entry));
        }

        const rows = this.db
            .prepare(
                `
                SELECT * FROM permission_requests
                WHERE agent_id = ? AND status = 'pending'
                ORDER BY created_at ASC, id ASC
                `
            )
            .all(normalizedAgentId) as DatabasePermissionRequestRow[];
        const parsed = rows.map((row) => this.recordParse(row));

        await this.cacheLock.inLock(() => {
            for (const record of parsed) {
                this.recordCacheSet(record);
            }
        });

        return parsed.map((entry) => permissionRequestClone(entry));
    }

    async updateStatus(
        token: string,
        status: PermissionRequestStatus,
        updatedAt: number,
        decision: PermissionDecision | null = null
    ): Promise<boolean> {
        const normalizedToken = token.trim();
        if (!normalizedToken) {
            return false;
        }

        const lock = this.recordLockForToken(normalizedToken);
        return lock.inLock(async () => {
            const cached = await this.cacheLock.inLock(() => {
                const existingId = this.recordIdsByToken.get(normalizedToken);
                if (!existingId) {
                    return null;
                }
                const existing = this.recordsById.get(existingId);
                return existing ? permissionRequestClone(existing) : null;
            });
            const current = cached ?? this.recordLoadByToken(normalizedToken);
            if (!current) {
                return false;
            }

            const updated = this.db
                .prepare(
                    `
                  UPDATE permission_requests
                  SET
                    status = ?,
                    decision = ?,
                    updated_at = ?
                  WHERE token = ?
                `
                )
                .run(status, decision ? JSON.stringify(decision) : null, updatedAt, normalizedToken);
            const rawChanges = (updated as { changes?: number | bigint }).changes;
            const changes = typeof rawChanges === "bigint" ? Number(rawChanges) : (rawChanges ?? 0);
            if (changes === 0) {
                return false;
            }

            const next: PermissionRequestDbRecord = {
                ...current,
                status,
                decision,
                updatedAt
            };
            await this.cacheLock.inLock(() => {
                this.recordCacheSet(next);
            });
            return true;
        });
    }

    async expirePending(now: number, updatedAt: number): Promise<number> {
        return this.expireLock.inLock(async () => {
            const rows = this.db
                .prepare("SELECT * FROM permission_requests WHERE status = 'pending' AND timeout_at <= ?")
                .all(now) as DatabasePermissionRequestRow[];
            if (rows.length === 0) {
                return 0;
            }

            const updated = this.db
                .prepare(
                    `
                    UPDATE permission_requests
                    SET status = 'expired', decision = NULL, updated_at = ?
                    WHERE status = 'pending' AND timeout_at <= ?
                    `
                )
                .run(updatedAt, now);
            const rawChanges = (updated as { changes?: number | bigint }).changes;
            const changes = typeof rawChanges === "bigint" ? Number(rawChanges) : (rawChanges ?? 0);
            if (changes === 0) {
                return 0;
            }

            const parsed = rows.map((row) => this.recordParse(row));
            await this.cacheLock.inLock(() => {
                for (const record of parsed) {
                    this.recordCacheSet({
                        ...record,
                        status: "expired",
                        decision: null,
                        updatedAt
                    });
                }
            });

            return changes;
        });
    }

    async findMany(): Promise<PermissionRequestDbRecord[]> {
        const cached = await this.cacheLock.inLock(() => {
            if (!this.allRecordsLoaded) {
                return null;
            }
            return permissionRequestsSort(Array.from(this.recordsById.values()));
        });
        if (cached) {
            return cached.map((entry) => permissionRequestClone(entry));
        }

        const rows = this.db
            .prepare("SELECT * FROM permission_requests ORDER BY created_at ASC, id ASC")
            .all() as DatabasePermissionRequestRow[];
        const parsed = rows.map((row) => this.recordParse(row));

        await this.cacheLock.inLock(() => {
            this.recordsById.clear();
            this.recordIdsByToken.clear();
            for (const record of parsed) {
                this.recordCacheSet(record);
            }
            this.allRecordsLoaded = true;
        });

        return parsed.map((entry) => permissionRequestClone(entry));
    }

    private recordLoadByToken(token: string): PermissionRequestDbRecord | null {
        const row = this.db.prepare("SELECT * FROM permission_requests WHERE token = ? LIMIT 1").get(token) as
            | DatabasePermissionRequestRow
            | undefined;
        if (!row) {
            return null;
        }
        return this.recordParse(row);
    }

    private recordParse(row: DatabasePermissionRequestRow): PermissionRequestDbRecord {
        return {
            id: row.id,
            token: row.token,
            agentId: row.agent_id,
            userId: row.user_id,
            status: permissionRequestStatusParse(row.status),
            permissions: JSON.parse(row.permissions) as PermissionRequest["permissions"],
            reason: row.reason,
            requester: JSON.parse(row.requester) as PermissionRequest["requester"],
            scope: row.scope as PermissionRequestScope | null,
            timeoutAt: row.timeout_at,
            decision: row.decision ? (JSON.parse(row.decision) as PermissionDecision) : null,
            createdAt: row.created_at,
            updatedAt: row.updated_at
        };
    }

    private recordCacheSet(record: PermissionRequestDbRecord): void {
        const previous = this.recordsById.get(record.id);
        if (previous && previous.token !== record.token) {
            this.recordIdsByToken.delete(previous.token);
        }
        const cloned = permissionRequestClone(record);
        this.recordsById.set(cloned.id, cloned);
        this.recordIdsByToken.set(cloned.token, cloned.id);
    }

    private recordLockForToken(token: string): AsyncLock {
        const existing = this.tokenLocks.get(token);
        if (existing) {
            return existing;
        }
        const lock = new AsyncLock();
        this.tokenLocks.set(token, lock);
        return lock;
    }
}

function permissionRequestStatusParse(rawStatus: string): PermissionRequestStatus {
    if (rawStatus === "approved" || rawStatus === "denied" || rawStatus === "expired") {
        return rawStatus;
    }
    return "pending";
}

function permissionRequestClone(record: PermissionRequestDbRecord): PermissionRequestDbRecord {
    return {
        ...record,
        permissions: JSON.parse(JSON.stringify(record.permissions)) as PermissionRequestDbRecord["permissions"],
        requester: JSON.parse(JSON.stringify(record.requester)) as PermissionRequestDbRecord["requester"],
        decision: record.decision
            ? (JSON.parse(JSON.stringify(record.decision)) as PermissionRequestDbRecord["decision"])
            : null
    };
}

function permissionRequestsSort(records: PermissionRequestDbRecord[]): PermissionRequestDbRecord[] {
    return records.slice().sort((left, right) => left.createdAt - right.createdAt || left.id.localeCompare(right.id));
}
