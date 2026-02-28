import { and, asc, eq, isNull } from "drizzle-orm";
import type { Context } from "@/types";
import type { DaycareDb } from "../schema.js";
import { channelMembersTable, channelsTable } from "../schema.js";
import { AsyncLock } from "../util/lock.js";
import type { ChannelDbRecord, ChannelMemberDbRecord } from "./databaseTypes.js";
import { versionAdvance } from "./versionAdvance.js";

/**
 * Channels repository backed by Drizzle with write-through caching.
 * Expects: schema migrations already applied for channels and channel_members.
 */
export class ChannelsRepository {
    private readonly db: DaycareDb;
    private readonly channelsById = new Map<string, ChannelDbRecord>();
    private readonly channelIdByName = new Map<string, string>();
    private readonly channelLocks = new Map<string, AsyncLock>();
    private readonly cacheLock = new AsyncLock();
    private readonly createLock = new AsyncLock();
    private allChannelsLoaded = false;

    constructor(db: DaycareDb) {
        this.db = db;
    }

    async create(record: ChannelDbRecord): Promise<void> {
        await this.createLock.inLock(async () => {
            const current = this.channelsById.get(record.id) ?? (await this.channelLoadById(record.id));
            const next = current
                ? await this.db.transaction(async (tx) =>
                      versionAdvance<ChannelDbRecord>({
                          changes: {
                              userId: record.userId,
                              name: record.name,
                              leader: record.leader,
                              createdAt: record.createdAt,
                              updatedAt: record.updatedAt
                          },
                          findCurrent: async () => current,
                          closeCurrent: async (row, now) => {
                              await tx
                                  .update(channelsTable)
                                  .set({ validTo: now })
                                  .where(
                                      and(
                                          eq(channelsTable.id, row.id),
                                          eq(channelsTable.version, row.version ?? 1),
                                          isNull(channelsTable.validTo)
                                      )
                                  );
                          },
                          insertNext: async (row) => {
                              await tx.insert(channelsTable).values({
                                  id: row.id,
                                  version: row.version ?? 1,
                                  validFrom: row.validFrom ?? row.createdAt,
                                  validTo: row.validTo ?? null,
                                  userId: row.userId,
                                  name: row.name,
                                  leader: row.leader,
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
                await this.db.insert(channelsTable).values({
                    id: next.id,
                    version: next.version ?? 1,
                    validFrom: next.validFrom ?? next.createdAt,
                    validTo: next.validTo ?? null,
                    userId: next.userId,
                    name: next.name,
                    leader: next.leader,
                    createdAt: next.createdAt,
                    updatedAt: next.updatedAt
                });
            }

            await this.cacheLock.inLock(() => {
                if (current && current.name !== next.name) {
                    this.channelIdByName.delete(current.name);
                }
                this.channelCacheSet(next);
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
            const loaded = await this.channelLoadById(id);
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

        const rows = await this.db
            .select()
            .from(channelsTable)
            .where(and(eq(channelsTable.name, name), isNull(channelsTable.validTo)))
            .limit(1);
        const row = rows[0];
        if (!row) {
            return null;
        }
        const parsed = channelParse(row);
        await this.cacheLock.inLock(() => {
            this.channelCacheSet(parsed);
        });
        return channelClone(parsed);
    }

    async findMany(ctx: Context): Promise<ChannelDbRecord[]> {
        const rows = await this.db
            .select()
            .from(channelsTable)
            .where(and(eq(channelsTable.userId, ctx.userId), isNull(channelsTable.validTo)))
            .orderBy(asc(channelsTable.createdAt), asc(channelsTable.id));
        return rows.map((row) => channelClone(channelParse(row)));
    }

    async findAll(): Promise<ChannelDbRecord[]> {
        if (this.allChannelsLoaded) {
            return channelsSort(Array.from(this.channelsById.values())).map((record) => channelClone(record));
        }

        const rows = await this.db
            .select()
            .from(channelsTable)
            .where(isNull(channelsTable.validTo))
            .orderBy(asc(channelsTable.createdAt), asc(channelsTable.id));
        const parsed = rows.map((row) => channelParse(row));

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
            const current = this.channelsById.get(id) ?? (await this.channelLoadById(id));
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

            const advanced = await this.db.transaction(async (tx) =>
                versionAdvance<ChannelDbRecord>({
                    changes: {
                        userId: next.userId,
                        name: next.name,
                        leader: next.leader,
                        createdAt: next.createdAt,
                        updatedAt: next.updatedAt
                    },
                    findCurrent: async () => current,
                    closeCurrent: async (row, now) => {
                        await tx
                            .update(channelsTable)
                            .set({ validTo: now })
                            .where(
                                and(
                                    eq(channelsTable.id, row.id),
                                    eq(channelsTable.version, row.version ?? 1),
                                    isNull(channelsTable.validTo)
                                )
                            );
                    },
                    insertNext: async (row) => {
                        await tx.insert(channelsTable).values({
                            id: row.id,
                            version: row.version ?? 1,
                            validFrom: row.validFrom ?? row.createdAt,
                            validTo: row.validTo ?? null,
                            userId: row.userId,
                            name: row.name,
                            leader: row.leader,
                            createdAt: row.createdAt,
                            updatedAt: row.updatedAt
                        });
                    }
                })
            );

            await this.cacheLock.inLock(() => {
                if (current.name !== advanced.name) {
                    this.channelIdByName.delete(current.name);
                }
                this.channelCacheSet(advanced);
            });
        });
    }

    async delete(id: string): Promise<boolean> {
        const lock = this.channelLockForId(id);
        return lock.inLock(async () => {
            const current = this.channelsById.get(id) ?? (await this.channelLoadById(id));
            if (!current) {
                return false;
            }
            await this.db
                .update(channelsTable)
                .set({ validTo: Date.now() })
                .where(
                    and(
                        eq(channelsTable.id, current.id),
                        eq(channelsTable.version, current.version ?? 1),
                        isNull(channelsTable.validTo)
                    )
                );

            await this.cacheLock.inLock(() => {
                this.channelsById.delete(id);
                if (current) {
                    this.channelIdByName.delete(current.name);
                }
            });

            return true;
        });
    }

    async addMember(
        channelId: string,
        record: Omit<ChannelMemberDbRecord, "id" | "channelId"> & { channelId?: string }
    ): Promise<ChannelMemberDbRecord> {
        await this.db
            .insert(channelMembersTable)
            .values({
                channelId,
                userId: record.userId,
                agentId: record.agentId,
                username: record.username,
                joinedAt: record.joinedAt
            })
            .onConflictDoUpdate({
                target: [channelMembersTable.channelId, channelMembersTable.agentId],
                set: {
                    userId: record.userId,
                    username: record.username,
                    joinedAt: record.joinedAt
                }
            });

        const memberRows = await this.db
            .select()
            .from(channelMembersTable)
            .where(and(eq(channelMembersTable.channelId, channelId), eq(channelMembersTable.agentId, record.agentId)))
            .limit(1);
        const memberRow = memberRows[0];
        if (!memberRow) {
            throw new Error("Failed to load inserted channel member.");
        }
        return memberParse(memberRow);
    }

    async removeMember(channelId: string, agentId: string): Promise<boolean> {
        const result = await this.db
            .delete(channelMembersTable)
            .where(and(eq(channelMembersTable.channelId, channelId), eq(channelMembersTable.agentId, agentId)))
            .returning({ id: channelMembersTable.id });
        return result.length > 0;
    }

    async findMembers(channelId: string): Promise<ChannelMemberDbRecord[]> {
        const rows = await this.db
            .select()
            .from(channelMembersTable)
            .where(eq(channelMembersTable.channelId, channelId))
            .orderBy(asc(channelMembersTable.joinedAt), asc(channelMembersTable.id));
        return rows.map((row) => memberParse(row));
    }

    private channelCacheSet(record: ChannelDbRecord): void {
        this.channelsById.set(record.id, channelClone(record));
        this.channelIdByName.set(record.name, record.id);
    }

    private async channelLoadById(id: string): Promise<ChannelDbRecord | null> {
        const rows = await this.db
            .select()
            .from(channelsTable)
            .where(and(eq(channelsTable.id, id), isNull(channelsTable.validTo)))
            .limit(1);
        const row = rows[0];
        if (!row) {
            return null;
        }
        return channelParse(row);
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

function channelParse(row: typeof channelsTable.$inferSelect): ChannelDbRecord {
    return {
        id: row.id,
        version: row.version ?? 1,
        validFrom: row.validFrom ?? row.createdAt,
        validTo: row.validTo ?? null,
        userId: row.userId,
        name: row.name,
        leader: row.leader,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt
    };
}

function channelClone(record: ChannelDbRecord): ChannelDbRecord {
    return {
        ...record
    };
}

function channelsSort(records: ChannelDbRecord[]): ChannelDbRecord[] {
    return records.slice().sort((left, right) => left.createdAt - right.createdAt || left.id.localeCompare(right.id));
}

function memberParse(row: typeof channelMembersTable.$inferSelect): ChannelMemberDbRecord {
    return {
        id: row.id,
        channelId: row.channelId,
        userId: row.userId,
        agentId: row.agentId,
        username: row.username,
        joinedAt: row.joinedAt
    };
}
