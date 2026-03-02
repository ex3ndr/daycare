import { createId } from "@paralleldrive/cuid2";
import { and, asc, eq, isNull } from "drizzle-orm";
import { nametagGenerate } from "../engine/friends/nametagGenerate.js";
import type { DaycareDb } from "../schema.js";
import { userConnectorKeysTable, usersTable } from "../schema.js";
import { AsyncLock } from "../utils/lock.js";
import type { CreateUserInput, UpdateUserInput, UserWithConnectorKeysDbRecord } from "./databaseTypes.js";
import { versionAdvance } from "./versionAdvance.js";

/**
 * Users repository backed by Drizzle with write-through caching.
 * Expects: schema migrations already applied for users and user_connector_keys.
 */
export class UsersRepository {
    private readonly db: DaycareDb;
    private readonly usersById = new Map<string, UserWithConnectorKeysDbRecord>();
    private readonly userIdByConnectorKey = new Map<string, string>();
    private readonly userIdByNametag = new Map<string, string>();
    private readonly userLocks = new Map<string, AsyncLock>();
    private readonly cacheLock = new AsyncLock();
    private readonly createLock = new AsyncLock();
    private allUsersLoaded = false;

    constructor(db: DaycareDb) {
        this.db = db;
    }

    async findById(id: string): Promise<UserWithConnectorKeysDbRecord | null> {
        const cached = this.usersById.get(id);
        if (cached) {
            return userClone(cached);
        }
        if (this.allUsersLoaded) {
            return null;
        }
        const lock = this.userLockForId(id);
        return lock.inLock(async () => {
            const existing = this.usersById.get(id);
            if (existing) {
                return userClone(existing);
            }
            const loaded = await this.userLoadById(id);
            if (!loaded) {
                return null;
            }
            await this.cacheLock.inLock(() => {
                this.userCacheSet(loaded);
            });
            return userClone(loaded);
        });
    }

    async findByConnectorKey(key: string): Promise<UserWithConnectorKeysDbRecord | null> {
        const cachedUserId = this.userIdByConnectorKey.get(key);
        if (cachedUserId) {
            return this.findById(cachedUserId);
        }

        const rows = await this.db
            .select({ userId: userConnectorKeysTable.userId })
            .from(userConnectorKeysTable)
            .where(eq(userConnectorKeysTable.connectorKey, key))
            .limit(1);

        const userId = rows[0]?.userId?.trim() ?? "";
        if (!userId) {
            return null;
        }

        await this.cacheLock.inLock(() => {
            this.userIdByConnectorKey.set(key, userId);
        });
        const user = await this.findById(userId);
        if (!user) {
            await this.cacheLock.inLock(() => {
                this.userIdByConnectorKey.delete(key);
            });
            return null;
        }
        return user;
    }

    async findByNametag(nametag: string): Promise<UserWithConnectorKeysDbRecord | null> {
        const normalized = nametag.trim();
        if (!normalized) {
            return null;
        }
        const cachedUserId = this.userIdByNametag.get(normalized);
        if (cachedUserId) {
            return this.findById(cachedUserId);
        }
        if (this.allUsersLoaded) {
            return null;
        }

        const rows = await this.db
            .select({ id: usersTable.id })
            .from(usersTable)
            .where(and(eq(usersTable.nametag, normalized), isNull(usersTable.validTo)))
            .limit(1);
        const userId = rows[0]?.id?.trim() ?? "";
        if (!userId) {
            return null;
        }

        await this.cacheLock.inLock(() => {
            this.userIdByNametag.set(normalized, userId);
        });
        const user = await this.findById(userId);
        if (!user) {
            await this.cacheLock.inLock(() => {
                this.userIdByNametag.delete(normalized);
            });
            return null;
        }
        return user;
    }

    async findMany(): Promise<UserWithConnectorKeysDbRecord[]> {
        if (this.allUsersLoaded) {
            return usersSort(Array.from(this.usersById.values())).map((user) => userClone(user));
        }

        const userRows = await this.db
            .select()
            .from(usersTable)
            .where(isNull(usersTable.validTo))
            .orderBy(asc(usersTable.createdAt), asc(usersTable.id));
        const keyRows = await this.db.select().from(userConnectorKeysTable).orderBy(asc(userConnectorKeysTable.id));

        const keysByUserId = new Map<string, (typeof keyRows)[number][]>();
        for (const keyRow of keyRows) {
            const rows = keysByUserId.get(keyRow.userId) ?? [];
            rows.push(keyRow);
            keysByUserId.set(keyRow.userId, rows);
        }

        const records = userRows.map((row) => {
            const record: UserWithConnectorKeysDbRecord = {
                id: row.id,
                version: row.version ?? 1,
                validFrom: row.validFrom ?? row.createdAt,
                validTo: row.validTo ?? null,
                isOwner: row.isOwner,
                isSwarm: row.isSwarm,
                parentUserId: row.parentUserId ?? null,
                firstName: row.firstName ?? null,
                lastName: row.lastName ?? null,
                bio: row.bio ?? null,
                about: row.about ?? null,
                country: row.country ?? null,
                timezone: row.timezone ?? null,
                systemPrompt: row.systemPrompt ?? null,
                memory: row.memory,
                nametag: row.nametag,
                createdAt: row.createdAt,
                updatedAt: row.updatedAt,
                connectorKeys: (keysByUserId.get(row.id) ?? []).map((keyRow) => ({
                    id: keyRow.id,
                    userId: keyRow.userId,
                    connectorKey: keyRow.connectorKey
                }))
            };
            return record;
        });

        await this.cacheLock.inLock(() => {
            this.usersById.clear();
            this.userIdByConnectorKey.clear();
            this.userIdByNametag.clear();
            for (const record of records) {
                this.userCacheSet(record);
            }
            this.allUsersLoaded = true;
        });
        return records.map((record) => userClone(record));
    }

    async findOwner(): Promise<UserWithConnectorKeysDbRecord | null> {
        const cachedOwner = Array.from(this.usersById.values()).find((user) => user.isOwner);
        if (cachedOwner) {
            return userClone(cachedOwner);
        }
        if (this.allUsersLoaded) {
            return null;
        }
        const rows = await this.db
            .select({ id: usersTable.id })
            .from(usersTable)
            .where(and(eq(usersTable.isOwner, true), isNull(usersTable.validTo)))
            .limit(1);
        const userId = rows[0]?.id?.trim() ?? "";
        if (!userId) {
            return null;
        }
        return this.findById(userId);
    }

    async create(input: CreateUserInput): Promise<UserWithConnectorKeysDbRecord> {
        return this.createLock.inLock(async () => {
            const now = Date.now();
            const id = input.id ?? createId();
            const createdAt = input.createdAt ?? now;
            const updatedAt = input.updatedAt ?? createdAt;
            const isOwner = input.isOwner ?? false;
            const isSwarm = input.isSwarm ?? false;
            const parentUserId = input.parentUserId ?? null;
            const firstName = textNullableNormalize(input.firstName);
            const lastName = textNullableNormalize(input.lastName);
            const bio = textNullableNormalize(input.bio);
            const about = textNullableNormalize(input.about);
            const country = textNullableNormalize(input.country);
            const timezone = textNullableNormalize(input.timezone);
            const systemPrompt = textNullableNormalize(input.systemPrompt);
            const memory = input.memory ?? false;
            const connectorKey = input.connectorKey?.trim() ?? "";
            const explicitNametag = input.nametag?.trim() ?? "";
            const shouldGenerateNametag = explicitNametag.length === 0;
            const maxGeneratedNametagAttempts = 100;

            let nametag: string | null = null;
            for (let attempt = 0; attempt < maxGeneratedNametagAttempts; attempt += 1) {
                nametag = shouldGenerateNametag ? nametagGenerate() : explicitNametag;
                try {
                    await this.db.insert(usersTable).values({
                        id,
                        version: 1,
                        validFrom: createdAt,
                        validTo: null,
                        isOwner,
                        isSwarm,
                        parentUserId,
                        firstName,
                        lastName,
                        bio,
                        about,
                        country,
                        timezone,
                        systemPrompt,
                        memory,
                        nametag,
                        createdAt,
                        updatedAt
                    });
                    break;
                } catch (error) {
                    if (!shouldGenerateNametag || !sqliteUniqueConstraintOnNametagIs(error)) {
                        throw error;
                    }
                    nametag = null;
                }
            }

            if (!nametag) {
                throw new Error("Failed to generate unique nametag after 100 attempts.");
            }

            const connectorKeys: UserWithConnectorKeysDbRecord["connectorKeys"] = [];
            if (connectorKey) {
                const inserted = await this.db
                    .insert(userConnectorKeysTable)
                    .values({ userId: id, connectorKey })
                    .returning({ id: userConnectorKeysTable.id });
                const insertedRow = inserted[0];
                if (!insertedRow) {
                    throw new Error("Failed to insert connector key.");
                }
                connectorKeys.push({ id: Number(insertedRow.id), userId: id, connectorKey });
            }

            const record: UserWithConnectorKeysDbRecord = {
                id,
                version: 1,
                validFrom: createdAt,
                validTo: null,
                isOwner,
                isSwarm,
                parentUserId,
                firstName,
                lastName,
                bio,
                about,
                country,
                timezone,
                systemPrompt,
                memory,
                nametag,
                createdAt,
                updatedAt,
                connectorKeys
            };
            await this.cacheLock.inLock(() => {
                this.userCacheSet(record);
            });
            return userClone(record);
        });
    }

    async update(id: string, data: UpdateUserInput): Promise<void> {
        const lock = this.userLockForId(id);
        await lock.inLock(async () => {
            const current = this.usersById.get(id) ?? (await this.userLoadById(id));
            if (!current) {
                throw new Error(`User not found: ${id}`);
            }

            const next: UserWithConnectorKeysDbRecord = {
                ...current,
                ...(data.isOwner === undefined ? {} : { isOwner: data.isOwner }),
                ...(data.isSwarm === undefined ? {} : { isSwarm: data.isSwarm }),
                ...(data.firstName === undefined ? {} : { firstName: textNullableNormalize(data.firstName) }),
                ...(data.lastName === undefined ? {} : { lastName: textNullableNormalize(data.lastName) }),
                ...(data.bio === undefined ? {} : { bio: textNullableNormalize(data.bio) }),
                ...(data.about === undefined ? {} : { about: textNullableNormalize(data.about) }),
                ...(data.country === undefined ? {} : { country: textNullableNormalize(data.country) }),
                ...(data.timezone === undefined ? {} : { timezone: textNullableNormalize(data.timezone) }),
                ...(data.systemPrompt === undefined ? {} : { systemPrompt: textNullableNormalize(data.systemPrompt) }),
                ...(data.memory === undefined ? {} : { memory: data.memory }),
                createdAt: data.createdAt ?? current.createdAt,
                updatedAt: data.updatedAt ?? current.updatedAt
            };

            const advanced = await this.db.transaction(async (tx) =>
                versionAdvance<UserWithConnectorKeysDbRecord>({
                    changes: {
                        isOwner: next.isOwner,
                        isSwarm: next.isSwarm,
                        firstName: next.firstName,
                        lastName: next.lastName,
                        bio: next.bio,
                        about: next.about,
                        country: next.country,
                        timezone: next.timezone,
                        systemPrompt: next.systemPrompt,
                        memory: next.memory,
                        createdAt: next.createdAt,
                        updatedAt: next.updatedAt
                    },
                    findCurrent: async () => current,
                    closeCurrent: async (row, now) => {
                        const closedRows = await tx
                            .update(usersTable)
                            .set({ validTo: now })
                            .where(
                                and(
                                    eq(usersTable.id, row.id),
                                    eq(usersTable.version, row.version ?? 1),
                                    isNull(usersTable.validTo)
                                )
                            )
                            .returning({ version: usersTable.version });
                        return closedRows.length;
                    },
                    insertNext: async (row) => {
                        await tx.insert(usersTable).values({
                            id: row.id,
                            version: row.version ?? 1,
                            validFrom: row.validFrom ?? row.createdAt,
                            validTo: row.validTo ?? null,
                            isOwner: row.isOwner,
                            isSwarm: row.isSwarm,
                            parentUserId: row.parentUserId,
                            firstName: row.firstName,
                            lastName: row.lastName,
                            bio: row.bio,
                            about: row.about,
                            country: row.country,
                            timezone: row.timezone,
                            systemPrompt: row.systemPrompt,
                            memory: row.memory,
                            nametag: row.nametag,
                            createdAt: row.createdAt,
                            updatedAt: row.updatedAt
                        });
                    }
                })
            );

            await this.cacheLock.inLock(() => {
                this.userCacheSet(advanced);
            });
        });
    }

    async delete(id: string): Promise<void> {
        const lock = this.userLockForId(id);
        await lock.inLock(async () => {
            const current = this.usersById.get(id) ?? (await this.userLoadById(id));
            if (current) {
                await this.db.transaction(async (tx) => {
                    await tx
                        .update(usersTable)
                        .set({ validTo: Date.now() })
                        .where(
                            and(
                                eq(usersTable.id, current.id),
                                eq(usersTable.version, current.version ?? 1),
                                isNull(usersTable.validTo)
                            )
                        );
                    await tx.delete(userConnectorKeysTable).where(eq(userConnectorKeysTable.userId, current.id));
                });
            }
            await this.cacheLock.inLock(() => {
                if (current) {
                    for (const connectorKey of current.connectorKeys) {
                        this.userIdByConnectorKey.delete(connectorKey.connectorKey);
                    }
                    this.userIdByNametag.delete(current.nametag);
                }
                this.usersById.delete(id);
            });
        });
    }

    async findByParentUserId(parentUserId: string): Promise<UserWithConnectorKeysDbRecord[]> {
        if (this.allUsersLoaded) {
            return usersSort(Array.from(this.usersById.values()).filter((u) => u.parentUserId === parentUserId)).map(
                (u) => userClone(u)
            );
        }
        // Load all users to populate the cache, then filter
        await this.findMany();
        return usersSort(Array.from(this.usersById.values()).filter((u) => u.parentUserId === parentUserId)).map((u) =>
            userClone(u)
        );
    }

    async addConnectorKey(userId: string, connectorKey: string): Promise<void> {
        const lock = this.userLockForId(userId);
        await lock.inLock(async () => {
            const current = this.usersById.get(userId) ?? (await this.userLoadById(userId));
            if (!current) {
                throw new Error(`User not found: ${userId}`);
            }

            const inserted = await this.db
                .insert(userConnectorKeysTable)
                .values({ userId, connectorKey })
                .returning({ id: userConnectorKeysTable.id });
            const insertedRow = inserted[0];
            if (!insertedRow) {
                throw new Error("Failed to insert connector key.");
            }
            const rowId = Number(insertedRow.id);

            const next: UserWithConnectorKeysDbRecord = {
                ...current,
                connectorKeys: [...current.connectorKeys, { id: rowId, userId, connectorKey }]
            };
            await this.cacheLock.inLock(() => {
                this.userCacheSet(next);
            });
        });
    }

    private userLockForId(userId: string): AsyncLock {
        const existing = this.userLocks.get(userId);
        if (existing) {
            return existing;
        }
        const lock = new AsyncLock();
        this.userLocks.set(userId, lock);
        return lock;
    }

    private async userLoadById(userId: string): Promise<UserWithConnectorKeysDbRecord | null> {
        const userRows = await this.db
            .select()
            .from(usersTable)
            .where(and(eq(usersTable.id, userId), isNull(usersTable.validTo)))
            .limit(1);
        const userRow = userRows[0];
        if (!userRow) {
            return null;
        }
        const keyRows = await this.db
            .select()
            .from(userConnectorKeysTable)
            .where(eq(userConnectorKeysTable.userId, userId))
            .orderBy(asc(userConnectorKeysTable.id));

        return {
            id: userRow.id,
            version: userRow.version ?? 1,
            validFrom: userRow.validFrom ?? userRow.createdAt,
            validTo: userRow.validTo ?? null,
            isOwner: userRow.isOwner,
            isSwarm: userRow.isSwarm,
            parentUserId: userRow.parentUserId ?? null,
            firstName: userRow.firstName ?? null,
            lastName: userRow.lastName ?? null,
            bio: userRow.bio ?? null,
            about: userRow.about ?? null,
            country: userRow.country ?? null,
            timezone: userRow.timezone ?? null,
            systemPrompt: userRow.systemPrompt ?? null,
            memory: userRow.memory,
            nametag: userRow.nametag,
            createdAt: userRow.createdAt,
            updatedAt: userRow.updatedAt,
            connectorKeys: keyRows.map((row) => ({
                id: row.id,
                userId: row.userId,
                connectorKey: row.connectorKey
            }))
        };
    }

    private userCacheSet(record: UserWithConnectorKeysDbRecord): void {
        this.usersById.set(record.id, userClone(record));
        this.userIdByNametag.set(record.nametag, record.id);
        for (const connectorKey of record.connectorKeys) {
            this.userIdByConnectorKey.set(connectorKey.connectorKey, record.id);
        }
    }
}

function sqliteUniqueConstraintOnNametagIs(error: unknown): boolean {
    const message = error instanceof Error ? error.message : String(error ?? "");
    return (
        message.includes("UNIQUE constraint failed: users.nametag") ||
        message.includes("duplicate key value violates unique constraint")
    );
}

function userClone(record: UserWithConnectorKeysDbRecord): UserWithConnectorKeysDbRecord {
    return {
        ...record,
        connectorKeys: record.connectorKeys.map((entry) => ({ ...entry }))
    };
}

function usersSort(records: UserWithConnectorKeysDbRecord[]): UserWithConnectorKeysDbRecord[] {
    return records.slice().sort((left, right) => left.createdAt - right.createdAt || left.id.localeCompare(right.id));
}

function textNullableNormalize(value: string | null | undefined): string | null {
    if (typeof value !== "string") {
        return null;
    }
    const normalized = value.trim();
    return normalized.length > 0 ? normalized : null;
}
