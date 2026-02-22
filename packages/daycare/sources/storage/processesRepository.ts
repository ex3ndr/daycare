import type { DatabaseSync } from "node:sqlite";
import type { Context } from "@/types";
import { AsyncLock } from "../util/lock.js";
import type { DatabaseProcessRow, ProcessDbRecord, ProcessOwnerDbRecord } from "./databaseTypes.js";

export type ProcessesFindManyOptions = {
    ownerId?: string;
    ownerType?: ProcessOwnerDbRecord["type"];
};

type ProcessesFindAllOptions = ProcessesFindManyOptions & {
    userId?: string;
};

/**
 * Processes repository backed by SQLite with write-through caching.
 * Expects: schema migrations already applied for processes.
 */
export class ProcessesRepository {
    private readonly db: DatabaseSync;
    private readonly recordsById = new Map<string, ProcessDbRecord>();
    private readonly recordLocks = new Map<string, AsyncLock>();
    private readonly cacheLock = new AsyncLock();
    private readonly createLock = new AsyncLock();
    private allRecordsLoaded = false;

    constructor(db: DatabaseSync) {
        this.db = db;
    }

    async create(record: ProcessDbRecord): Promise<void> {
        await this.createLock.inLock(async () => {
            this.db
                .prepare(
                    `
                  INSERT INTO processes (
                    id,
                    user_id,
                    name,
                    command,
                    cwd,
                    home,
                    env,
                    package_managers,
                    allowed_domains,
                    allow_local_binding,
                    permissions,
                    owner,
                    keep_alive,
                    desired_state,
                    status,
                    pid,
                    boot_time_ms,
                    restart_count,
                    restart_failure_count,
                    next_restart_at,
                    settings_path,
                    log_path,
                    created_at,
                    updated_at,
                    last_started_at,
                    last_exited_at
                  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                  ON CONFLICT(id) DO UPDATE SET
                    user_id = excluded.user_id,
                    name = excluded.name,
                    command = excluded.command,
                    cwd = excluded.cwd,
                    home = excluded.home,
                    env = excluded.env,
                    package_managers = excluded.package_managers,
                    allowed_domains = excluded.allowed_domains,
                    allow_local_binding = excluded.allow_local_binding,
                    permissions = excluded.permissions,
                    owner = excluded.owner,
                    keep_alive = excluded.keep_alive,
                    desired_state = excluded.desired_state,
                    status = excluded.status,
                    pid = excluded.pid,
                    boot_time_ms = excluded.boot_time_ms,
                    restart_count = excluded.restart_count,
                    restart_failure_count = excluded.restart_failure_count,
                    next_restart_at = excluded.next_restart_at,
                    settings_path = excluded.settings_path,
                    log_path = excluded.log_path,
                    created_at = excluded.created_at,
                    updated_at = excluded.updated_at,
                    last_started_at = excluded.last_started_at,
                    last_exited_at = excluded.last_exited_at
                `
                )
                .run(
                    record.id,
                    record.userId,
                    record.name,
                    record.command,
                    record.cwd,
                    record.home,
                    JSON.stringify(record.env),
                    JSON.stringify(record.packageManagers),
                    JSON.stringify(record.allowedDomains),
                    record.allowLocalBinding ? 1 : 0,
                    JSON.stringify(record.permissions),
                    record.owner ? JSON.stringify(record.owner) : null,
                    record.keepAlive ? 1 : 0,
                    record.desiredState,
                    record.status,
                    record.pid,
                    record.bootTimeMs,
                    record.restartCount,
                    record.restartFailureCount,
                    record.nextRestartAt,
                    record.settingsPath,
                    record.logPath,
                    record.createdAt,
                    record.updatedAt,
                    record.lastStartedAt,
                    record.lastExitedAt
                );

            await this.cacheLock.inLock(() => {
                this.recordCacheSet(record);
            });
        });
    }

    async findById(id: string): Promise<ProcessDbRecord | null> {
        const cached = await this.cacheLock.inLock(() => {
            const existing = this.recordsById.get(id);
            if (existing) {
                return processRecordClone(existing);
            }
            if (this.allRecordsLoaded) {
                return null;
            }
            return undefined;
        });
        if (cached !== undefined) {
            return cached;
        }

        const lock = this.recordLockForId(id);
        return lock.inLock(async () => {
            const existing = await this.cacheLock.inLock(() => {
                const record = this.recordsById.get(id);
                return record ? processRecordClone(record) : null;
            });
            if (existing) {
                return existing;
            }
            const loaded = this.recordLoadById(id);
            if (!loaded) {
                return null;
            }
            await this.cacheLock.inLock(() => {
                this.recordCacheSet(loaded);
            });
            return processRecordClone(loaded);
        });
    }

    async findMany(ctx: Context, options: ProcessesFindManyOptions = {}): Promise<ProcessDbRecord[]> {
        return this.findAll({ ...options, userId: ctx.userId });
    }

    async findAll(options: ProcessesFindAllOptions = {}): Promise<ProcessDbRecord[]> {
        const cached = await this.cacheLock.inLock(() => {
            if (!this.allRecordsLoaded || options.userId) {
                return null;
            }
            return processesSort(Array.from(this.recordsById.values()));
        });
        if (cached) {
            return this.processesFilter(cached, options).map((record) => processRecordClone(record));
        }

        const rows = options.userId
            ? (this.db
                  .prepare("SELECT * FROM processes WHERE user_id = ? ORDER BY created_at ASC, id ASC")
                  .all(options.userId) as DatabaseProcessRow[])
            : (this.db
                  .prepare("SELECT * FROM processes ORDER BY created_at ASC, id ASC")
                  .all() as DatabaseProcessRow[]);

        const parsed = rows.map((row) => this.recordParse(row));

        await this.cacheLock.inLock(() => {
            for (const record of parsed) {
                this.recordCacheSet(record);
            }
            if (!options.userId) {
                this.allRecordsLoaded = true;
            }
        });

        return this.processesFilter(parsed, options).map((record) => processRecordClone(record));
    }

    async update(id: string, data: Partial<ProcessDbRecord>): Promise<void> {
        const lock = this.recordLockForId(id);
        await lock.inLock(async () => {
            const current = this.recordsById.get(id) ?? this.recordLoadById(id);
            if (!current) {
                throw new Error(`Process not found: ${id}`);
            }

            const next: ProcessDbRecord = {
                ...current,
                ...data,
                id: current.id,
                userId: data.userId ?? current.userId,
                name: data.name ?? current.name,
                command: data.command ?? current.command,
                cwd: data.cwd ?? current.cwd,
                home: data.home === undefined ? current.home : data.home,
                env: data.env ?? current.env,
                packageManagers: data.packageManagers ?? current.packageManagers,
                allowedDomains: data.allowedDomains ?? current.allowedDomains,
                allowLocalBinding: data.allowLocalBinding ?? current.allowLocalBinding,
                permissions: data.permissions ?? current.permissions,
                owner: data.owner === undefined ? current.owner : data.owner,
                keepAlive: data.keepAlive ?? current.keepAlive,
                desiredState: data.desiredState ?? current.desiredState,
                status: data.status ?? current.status,
                pid: data.pid === undefined ? current.pid : data.pid,
                bootTimeMs: data.bootTimeMs === undefined ? current.bootTimeMs : data.bootTimeMs,
                restartCount: data.restartCount ?? current.restartCount,
                restartFailureCount: data.restartFailureCount ?? current.restartFailureCount,
                nextRestartAt: data.nextRestartAt === undefined ? current.nextRestartAt : data.nextRestartAt,
                settingsPath: data.settingsPath ?? current.settingsPath,
                logPath: data.logPath ?? current.logPath,
                createdAt: data.createdAt ?? current.createdAt,
                updatedAt: data.updatedAt ?? current.updatedAt,
                lastStartedAt: data.lastStartedAt === undefined ? current.lastStartedAt : data.lastStartedAt,
                lastExitedAt: data.lastExitedAt === undefined ? current.lastExitedAt : data.lastExitedAt
            };

            this.db
                .prepare(
                    `
                  UPDATE processes
                  SET
                    user_id = ?,
                    name = ?,
                    command = ?,
                    cwd = ?,
                    home = ?,
                    env = ?,
                    package_managers = ?,
                    allowed_domains = ?,
                    allow_local_binding = ?,
                    permissions = ?,
                    owner = ?,
                    keep_alive = ?,
                    desired_state = ?,
                    status = ?,
                    pid = ?,
                    boot_time_ms = ?,
                    restart_count = ?,
                    restart_failure_count = ?,
                    next_restart_at = ?,
                    settings_path = ?,
                    log_path = ?,
                    created_at = ?,
                    updated_at = ?,
                    last_started_at = ?,
                    last_exited_at = ?
                  WHERE id = ?
                `
                )
                .run(
                    next.userId,
                    next.name,
                    next.command,
                    next.cwd,
                    next.home,
                    JSON.stringify(next.env),
                    JSON.stringify(next.packageManagers),
                    JSON.stringify(next.allowedDomains),
                    next.allowLocalBinding ? 1 : 0,
                    JSON.stringify(next.permissions),
                    next.owner ? JSON.stringify(next.owner) : null,
                    next.keepAlive ? 1 : 0,
                    next.desiredState,
                    next.status,
                    next.pid,
                    next.bootTimeMs,
                    next.restartCount,
                    next.restartFailureCount,
                    next.nextRestartAt,
                    next.settingsPath,
                    next.logPath,
                    next.createdAt,
                    next.updatedAt,
                    next.lastStartedAt,
                    next.lastExitedAt,
                    id
                );

            await this.cacheLock.inLock(() => {
                this.recordCacheSet(next);
            });
        });
    }

    async delete(id: string): Promise<boolean> {
        const lock = this.recordLockForId(id);
        return lock.inLock(async () => {
            const removed = this.db.prepare("DELETE FROM processes WHERE id = ?").run(id);
            const rawChanges = (removed as { changes?: number | bigint }).changes;
            const changes = typeof rawChanges === "bigint" ? Number(rawChanges) : (rawChanges ?? 0);
            await this.cacheLock.inLock(() => {
                this.recordsById.delete(id);
            });
            return changes > 0;
        });
    }

    async deleteByOwner(ownerType: ProcessOwnerDbRecord["type"], ownerId: string): Promise<number> {
        const targets = await this.findAll({ ownerType, ownerId });
        let count = 0;
        for (const target of targets) {
            const removed = await this.delete(target.id);
            if (removed) {
                count += 1;
            }
        }
        return count;
    }

    private processesFilter(records: ProcessDbRecord[], options: ProcessesFindAllOptions): ProcessDbRecord[] {
        return records.filter((record) => {
            if (options.userId && record.userId !== options.userId) {
                return false;
            }
            if (options.ownerId) {
                if (!record.owner || record.owner.id !== options.ownerId) {
                    return false;
                }
            }
            if (options.ownerType) {
                if (!record.owner || record.owner.type !== options.ownerType) {
                    return false;
                }
            }
            return true;
        });
    }

    private recordLoadById(id: string): ProcessDbRecord | null {
        const row = this.db.prepare("SELECT * FROM processes WHERE id = ? LIMIT 1").get(id) as
            | DatabaseProcessRow
            | undefined;
        if (!row) {
            return null;
        }
        return this.recordParse(row);
    }

    private recordParse(row: DatabaseProcessRow): ProcessDbRecord {
        return {
            id: row.id,
            userId: row.user_id,
            name: row.name,
            command: row.command,
            cwd: row.cwd,
            home: row.home,
            env: jsonRecordParse(row.env),
            packageManagers: jsonStringArrayParse(row.package_managers),
            allowedDomains: jsonStringArrayParse(row.allowed_domains),
            allowLocalBinding: row.allow_local_binding === 1,
            permissions: permissionsParse(row.permissions),
            owner: ownerParse(row.owner),
            keepAlive: row.keep_alive === 1,
            desiredState: row.desired_state,
            status: row.status,
            pid: row.pid,
            bootTimeMs: row.boot_time_ms,
            restartCount: row.restart_count,
            restartFailureCount: row.restart_failure_count,
            nextRestartAt: row.next_restart_at,
            settingsPath: row.settings_path,
            logPath: row.log_path,
            createdAt: row.created_at,
            updatedAt: row.updated_at,
            lastStartedAt: row.last_started_at,
            lastExitedAt: row.last_exited_at
        };
    }

    private recordCacheSet(record: ProcessDbRecord): void {
        this.recordsById.set(record.id, processRecordClone(record));
    }

    private recordLockForId(recordId: string): AsyncLock {
        const existing = this.recordLocks.get(recordId);
        if (existing) {
            return existing;
        }
        const lock = new AsyncLock();
        this.recordLocks.set(recordId, lock);
        return lock;
    }
}

function processRecordClone(record: ProcessDbRecord): ProcessDbRecord {
    return {
        ...record,
        env: { ...record.env },
        packageManagers: [...record.packageManagers],
        allowedDomains: [...record.allowedDomains],
        permissions: {
            ...record.permissions,
            writeDirs: [...record.permissions.writeDirs],
            readDirs: [...(record.permissions.readDirs ?? [])]
        },
        owner: record.owner ? { ...record.owner } : null
    };
}

function processesSort(records: ProcessDbRecord[]): ProcessDbRecord[] {
    return records.slice().sort((left, right) => left.createdAt - right.createdAt || left.id.localeCompare(right.id));
}

function jsonRecordParse(raw: string): Record<string, string> {
    try {
        const parsed = JSON.parse(raw) as unknown;
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
            return {};
        }
        const entries = Object.entries(parsed).filter(
            (entry): entry is [string, string] => typeof entry[0] === "string" && typeof entry[1] === "string"
        );
        return Object.fromEntries(entries);
    } catch {
        return {};
    }
}

function jsonStringArrayParse(raw: string): string[] {
    try {
        const parsed = JSON.parse(raw) as unknown;
        if (!Array.isArray(parsed)) {
            return [];
        }
        return parsed.filter((entry): entry is string => typeof entry === "string");
    } catch {
        return [];
    }
}

function permissionsParse(raw: string): ProcessDbRecord["permissions"] {
    try {
        const parsed = JSON.parse(raw) as Partial<ProcessDbRecord["permissions"]>;
        if (typeof parsed.workingDir !== "string" || !Array.isArray(parsed.writeDirs)) {
            throw new Error("Invalid permissions");
        }
        const readDirs = Array.isArray(parsed.readDirs)
            ? parsed.readDirs.filter((entry): entry is string => typeof entry === "string")
            : [];
        return {
            workingDir: parsed.workingDir,
            writeDirs: parsed.writeDirs.filter((entry): entry is string => typeof entry === "string"),
            readDirs
        };
    } catch {
        return {
            workingDir: "/",
            writeDirs: [],
            readDirs: []
        };
    }
}

function ownerParse(raw: string | null): ProcessOwnerDbRecord | null {
    if (!raw) {
        return null;
    }
    try {
        const parsed = JSON.parse(raw) as { type?: unknown; id?: unknown };
        if (parsed.type !== "plugin" || typeof parsed.id !== "string" || !parsed.id.trim()) {
            return null;
        }
        return { type: "plugin", id: parsed.id.trim() };
    } catch {
        return null;
    }
}
