import type { StorageDatabase as DatabaseSync } from "./databaseOpen.js";
import { createId } from "@paralleldrive/cuid2";
import { nametagGenerate } from "../engine/friends/nametagGenerate.js";
import { AsyncLock } from "../util/lock.js";
import type {
    CreateUserInput,
    DatabaseUserConnectorKeyRow,
    DatabaseUserRow,
    UpdateUserInput,
    UserWithConnectorKeysDbRecord
} from "./databaseTypes.js";

/**
 * Users repository backed by SQLite with write-through caching.
 * Expects: schema migrations already applied for users and user_connector_keys.
 */
export class UsersRepository {
    private readonly db: DatabaseSync;
    private readonly usersById = new Map<string, UserWithConnectorKeysDbRecord>();
    private readonly userIdByConnectorKey = new Map<string, string>();
    private readonly userIdByNametag = new Map<string, string>();
    private readonly userLocks = new Map<string, AsyncLock>();
    private readonly cacheLock = new AsyncLock();
    private readonly createLock = new AsyncLock();
    private allUsersLoaded = false;

    constructor(db: DatabaseSync) {
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
            const loaded = this.userLoadById(id);
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

        const row = this.db
            .prepare(
                `
              SELECT user_id
              FROM user_connector_keys
              WHERE connector_key = ?
              LIMIT 1
            `
            )
            .get(key) as { user_id?: string } | undefined;

        const userId = row?.user_id?.trim() ?? "";
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

        const row = this.db.prepare("SELECT id FROM users WHERE nametag = ? LIMIT 1").get(normalized) as
            | { id?: string }
            | undefined;
        const userId = row?.id?.trim() ?? "";
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

        const userRows = this.db
            .prepare("SELECT * FROM users ORDER BY created_at ASC, id ASC")
            .all() as DatabaseUserRow[];
        const keyRows = this.db
            .prepare(
                `
              SELECT id, user_id, connector_key
              FROM user_connector_keys
              ORDER BY id ASC
            `
            )
            .all() as DatabaseUserConnectorKeyRow[];

        const keysByUserId = new Map<string, DatabaseUserConnectorKeyRow[]>();
        for (const keyRow of keyRows) {
            const rows = keysByUserId.get(keyRow.user_id) ?? [];
            rows.push(keyRow);
            keysByUserId.set(keyRow.user_id, rows);
        }

        const records = userRows.map((row) => {
            const record: UserWithConnectorKeysDbRecord = {
                id: row.id,
                isOwner: row.is_owner === 1,
                parentUserId: row.parent_user_id ?? null,
                name: row.name ?? null,
                nametag: row.nametag,
                createdAt: row.created_at,
                updatedAt: row.updated_at,
                connectorKeys: (keysByUserId.get(row.id) ?? []).map((keyRow) => ({
                    id: keyRow.id,
                    userId: keyRow.user_id,
                    connectorKey: keyRow.connector_key
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
        const row = this.db.prepare("SELECT id FROM users WHERE is_owner = 1 LIMIT 1").get() as
            | { id?: string }
            | undefined;
        const userId = row?.id?.trim() ?? "";
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
            const parentUserId = input.parentUserId ?? null;
            const name = input.name ?? null;
            const connectorKey = input.connectorKey?.trim() ?? "";
            const explicitNametag = input.nametag?.trim() ?? "";
            const shouldGenerateNametag = explicitNametag.length === 0;
            const maxGeneratedNametagAttempts = 100;

            let nametag: string | null = null;
            for (let attempt = 0; attempt < maxGeneratedNametagAttempts; attempt += 1) {
                nametag = shouldGenerateNametag ? nametagGenerate() : explicitNametag;
                try {
                    this.db
                        .prepare(
                            "INSERT INTO users (id, is_owner, parent_user_id, name, nametag, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)"
                        )
                        .run(id, isOwner ? 1 : 0, parentUserId, name, nametag, createdAt, updatedAt);
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
                const inserted = this.db
                    .prepare("INSERT INTO user_connector_keys (user_id, connector_key) VALUES (?, ?)")
                    .run(id, connectorKey);
                const rawRowId = inserted.lastInsertRowid;
                const rowId = typeof rawRowId === "bigint" ? Number(rawRowId) : rawRowId;
                connectorKeys.push({ id: rowId, userId: id, connectorKey });
            }

            const record: UserWithConnectorKeysDbRecord = {
                id,
                isOwner,
                parentUserId,
                name,
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
            const current = this.usersById.get(id) ?? this.userLoadById(id);
            if (!current) {
                throw new Error(`User not found: ${id}`);
            }

            const next: UserWithConnectorKeysDbRecord = {
                ...current,
                ...(data.isOwner === undefined ? {} : { isOwner: data.isOwner }),
                createdAt: data.createdAt ?? current.createdAt,
                updatedAt: data.updatedAt ?? current.updatedAt
            };

            this.db
                .prepare(
                    `
                  UPDATE users
                  SET is_owner = ?, created_at = ?, updated_at = ?
                  WHERE id = ?
                `
                )
                .run(next.isOwner ? 1 : 0, next.createdAt, next.updatedAt, id);

            await this.cacheLock.inLock(() => {
                this.userCacheSet(next);
            });
        });
    }

    async delete(id: string): Promise<void> {
        const lock = this.userLockForId(id);
        await lock.inLock(async () => {
            const current = this.usersById.get(id) ?? this.userLoadById(id);
            this.db.prepare("DELETE FROM users WHERE id = ?").run(id);
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
            const current = this.usersById.get(userId) ?? this.userLoadById(userId);
            if (!current) {
                throw new Error(`User not found: ${userId}`);
            }

            const inserted = this.db
                .prepare("INSERT INTO user_connector_keys (user_id, connector_key) VALUES (?, ?)")
                .run(userId, connectorKey);
            const rawRowId = inserted.lastInsertRowid;
            const rowId = typeof rawRowId === "bigint" ? Number(rawRowId) : rawRowId;

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

    private userLoadById(userId: string): UserWithConnectorKeysDbRecord | null {
        const userRow = this.db.prepare("SELECT * FROM users WHERE id = ? LIMIT 1").get(userId) as
            | DatabaseUserRow
            | undefined;
        if (!userRow) {
            return null;
        }
        const keyRows = this.db
            .prepare(
                `
              SELECT id, user_id, connector_key
              FROM user_connector_keys
              WHERE user_id = ?
              ORDER BY id ASC
            `
            )
            .all(userId) as DatabaseUserConnectorKeyRow[];

        return {
            id: userRow.id,
            isOwner: userRow.is_owner === 1,
            parentUserId: userRow.parent_user_id ?? null,
            name: userRow.name ?? null,
            nametag: userRow.nametag,
            createdAt: userRow.created_at,
            updatedAt: userRow.updated_at,
            connectorKeys: keyRows.map((row) => ({
                id: row.id,
                userId: row.user_id,
                connectorKey: row.connector_key
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
    return message.includes("UNIQUE constraint failed: users.nametag");
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
