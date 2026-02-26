import type { Context } from "@/types";
import { AsyncLock } from "../util/lock.js";
import type { StorageDatabase } from "./databaseOpen.js";
import type {
    ChannelDbRecord,
    ChannelMemberDbRecord,
    DatabaseChannelMemberRow,
    DatabaseChannelRow
} from "./databaseTypes.js";

/**
 * Channels repository backed by SQLite with write-through caching.
 * Expects: schema migrations already applied for channels and channel_members.
 */
export class ChannelsRepository {
    private readonly db: StorageDatabase;
    private readonly channelsById = new Map<string, ChannelDbRecord>();
    private readonly channelIdByName = new Map<string, string>();
    private readonly channelLocks = new Map<string, AsyncLock>();
    private readonly cacheLock = new AsyncLock();
    private readonly createLock = new AsyncLock();
    private allChannelsLoaded = false;

    constructor(db: StorageDatabase) {
        this.db = db;
    }

    async create(record: ChannelDbRecord): Promise<void> {
        await this.createLock.inLock(async () => {
            this.db
                .prepare(
                    `
                  INSERT INTO channels (
                    id,
                    user_id,
                    name,
                    leader,
                    created_at,
                    updated_at
                  ) VALUES (?, ?, ?, ?, ?, ?)
                  ON CONFLICT(id) DO UPDATE SET
                    user_id = excluded.user_id,
                    name = excluded.name,
                    leader = excluded.leader,
                    created_at = excluded.created_at,
                    updated_at = excluded.updated_at
                `
                )
                .run(record.id, record.userId, record.name, record.leader, record.createdAt, record.updatedAt);

            await this.cacheLock.inLock(() => {
                this.channelCacheSet(record);
            });
        });
    }

    async findById(id: string): Promise<ChannelDbRecord | null> {
        const cached = this.channelsById.get(id);
        if (cached) {
            return channelClone(cached);
        }
        if (this.allChannelsLoaded) {
            return null;
        }

        const lock = this.channelLockForId(id);
        return lock.inLock(async () => {
            const existing = this.channelsById.get(id);
            if (existing) {
                return channelClone(existing);
            }
            const loaded = this.channelLoadById(id);
            if (!loaded) {
                return null;
            }
            await this.cacheLock.inLock(() => {
                this.channelCacheSet(loaded);
            });
            return channelClone(loaded);
        });
    }

    async findByName(name: string): Promise<ChannelDbRecord | null> {
        const cachedId = this.channelIdByName.get(name);
        if (cachedId) {
            return this.findById(cachedId);
        }
        if (this.allChannelsLoaded) {
            return null;
        }

        const row = this.db.prepare("SELECT * FROM channels WHERE name = ? LIMIT 1").get(name) as
            | DatabaseChannelRow
            | undefined;
        if (!row) {
            return null;
        }
        const parsed = this.channelParse(row);
        await this.cacheLock.inLock(() => {
            this.channelCacheSet(parsed);
        });
        return channelClone(parsed);
    }

    async findMany(ctx: Context): Promise<ChannelDbRecord[]> {
        const rows = this.db
            .prepare("SELECT * FROM channels WHERE user_id = ? ORDER BY created_at ASC, id ASC")
            .all(ctx.userId) as DatabaseChannelRow[];
        return rows.map((row) => channelClone(this.channelParse(row)));
    }

    async findAll(): Promise<ChannelDbRecord[]> {
        if (this.allChannelsLoaded) {
            return channelsSort(Array.from(this.channelsById.values())).map((record) => channelClone(record));
        }

        const rows = this.db
            .prepare("SELECT * FROM channels ORDER BY created_at ASC, id ASC")
            .all() as DatabaseChannelRow[];
        const parsed = rows.map((row) => this.channelParse(row));

        await this.cacheLock.inLock(() => {
            for (const record of parsed) {
                this.channelCacheSet(record);
            }
            this.allChannelsLoaded = true;
        });

        return parsed.map((record) => channelClone(record));
    }

    async update(id: string, data: Partial<ChannelDbRecord>): Promise<void> {
        const lock = this.channelLockForId(id);
        await lock.inLock(async () => {
            const current = this.channelsById.get(id) ?? this.channelLoadById(id);
            if (!current) {
                throw new Error(`Channel not found: ${id}`);
            }

            const next: ChannelDbRecord = {
                ...current,
                ...data,
                id: current.id,
                userId: data.userId ?? current.userId,
                name: data.name ?? current.name,
                leader: data.leader ?? current.leader,
                createdAt: data.createdAt ?? current.createdAt,
                updatedAt: data.updatedAt ?? current.updatedAt
            };

            this.db
                .prepare(
                    `
                  UPDATE channels
                  SET user_id = ?, name = ?, leader = ?, created_at = ?, updated_at = ?
                  WHERE id = ?
                `
                )
                .run(next.userId, next.name, next.leader, next.createdAt, next.updatedAt, id);

            await this.cacheLock.inLock(() => {
                this.channelCacheSet(next);
            });
        });
    }

    async delete(id: string): Promise<boolean> {
        const lock = this.channelLockForId(id);
        return lock.inLock(async () => {
            const current = this.channelsById.get(id) ?? this.channelLoadById(id);
            const removed = this.db.prepare("DELETE FROM channels WHERE id = ?").run(id);
            const rawChanges = (removed as { changes?: number | bigint }).changes;
            const changes = typeof rawChanges === "bigint" ? Number(rawChanges) : (rawChanges ?? 0);

            await this.cacheLock.inLock(() => {
                this.channelsById.delete(id);
                if (current) {
                    this.channelIdByName.delete(current.name);
                }
            });

            return changes > 0;
        });
    }

    async addMember(
        channelId: string,
        record: Omit<ChannelMemberDbRecord, "id" | "channelId"> & { channelId?: string }
    ): Promise<ChannelMemberDbRecord> {
        const inserted = this.db
            .prepare(
                `
              INSERT INTO channel_members (
                channel_id,
                user_id,
                agent_id,
                username,
                joined_at
              ) VALUES (?, ?, ?, ?, ?)
              ON CONFLICT(channel_id, agent_id) DO UPDATE SET
                user_id = excluded.user_id,
                username = excluded.username,
                joined_at = excluded.joined_at
            `
            )
            .run(channelId, record.userId, record.agentId, record.username, record.joinedAt);

        const existing = this.db
            .prepare("SELECT * FROM channel_members WHERE channel_id = ? AND agent_id = ? LIMIT 1")
            .get(channelId, record.agentId) as DatabaseChannelMemberRow | undefined;
        if (!existing) {
            const rowIdRaw = inserted.lastInsertRowid;
            const rowId = typeof rowIdRaw === "bigint" ? Number(rowIdRaw) : rowIdRaw;
            return {
                id: rowId,
                channelId,
                userId: record.userId,
                agentId: record.agentId,
                username: record.username,
                joinedAt: record.joinedAt
            };
        }
        return memberParse(existing);
    }

    async removeMember(channelId: string, agentId: string): Promise<boolean> {
        const removed = this.db
            .prepare("DELETE FROM channel_members WHERE channel_id = ? AND agent_id = ?")
            .run(channelId, agentId);
        const rawChanges = (removed as { changes?: number | bigint }).changes;
        const changes = typeof rawChanges === "bigint" ? Number(rawChanges) : (rawChanges ?? 0);
        return changes > 0;
    }

    async findMembers(channelId: string): Promise<ChannelMemberDbRecord[]> {
        const rows = this.db
            .prepare("SELECT * FROM channel_members WHERE channel_id = ? ORDER BY joined_at ASC, id ASC")
            .all(channelId) as DatabaseChannelMemberRow[];
        return rows.map((row) => memberParse(row));
    }

    private channelCacheSet(record: ChannelDbRecord): void {
        this.channelsById.set(record.id, channelClone(record));
        this.channelIdByName.set(record.name, record.id);
    }

    private channelLoadById(id: string): ChannelDbRecord | null {
        const row = this.db.prepare("SELECT * FROM channels WHERE id = ? LIMIT 1").get(id) as
            | DatabaseChannelRow
            | undefined;
        if (!row) {
            return null;
        }
        return this.channelParse(row);
    }

    private channelParse(row: DatabaseChannelRow): ChannelDbRecord {
        return {
            id: row.id,
            userId: row.user_id,
            name: row.name,
            leader: row.leader,
            createdAt: row.created_at,
            updatedAt: row.updated_at
        };
    }

    private channelLockForId(channelId: string): AsyncLock {
        const existing = this.channelLocks.get(channelId);
        if (existing) {
            return existing;
        }
        const lock = new AsyncLock();
        this.channelLocks.set(channelId, lock);
        return lock;
    }
}

function channelClone(record: ChannelDbRecord): ChannelDbRecord {
    return {
        ...record
    };
}

function channelsSort(records: ChannelDbRecord[]): ChannelDbRecord[] {
    return records.slice().sort((left, right) => left.createdAt - right.createdAt || left.id.localeCompare(right.id));
}

function memberParse(row: DatabaseChannelMemberRow): ChannelMemberDbRecord {
    return {
        id: row.id,
        channelId: row.channel_id,
        userId: row.user_id,
        agentId: row.agent_id,
        username: row.username,
        joinedAt: row.joined_at
    };
}
