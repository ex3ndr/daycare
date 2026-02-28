import { asc, eq } from "drizzle-orm";
import type { Context } from "@/types";
import type { DaycareDb } from "../schema.js";
import { processesTable } from "../schema.js";
import { AsyncLock } from "../util/lock.js";
import type { ProcessDbRecord, ProcessOwnerDbRecord } from "./databaseTypes.js";

export type ProcessesFindManyOptions = {
    ownerId?: string;
    ownerType?: ProcessOwnerDbRecord["type"];
};

type ProcessesFindAllOptions = ProcessesFindManyOptions & {
    userId?: string;
};

/**
 * Processes repository backed by Drizzle with write-through caching.
 * Expects: schema migrations already applied for processes.
 */
export class ProcessesRepository {
    private readonly db: DaycareDb;
    private readonly recordsById = new Map<string, ProcessDbRecord>();
    private readonly recordLocks = new Map<string, AsyncLock>();
    private readonly cacheLock = new AsyncLock();
    private readonly createLock = new AsyncLock();
    private allRecordsLoaded = false;

    constructor(db: DaycareDb) {
        this.db = db;
    }

    async create(record: ProcessDbRecord): Promise<void> {
        await this.createLock.inLock(async () => {
            const values = {
                id: record.id,
                userId: record.userId,
                name: record.name,
                command: record.command,
                cwd: record.cwd,
                home: record.home,
                env: JSON.stringify(record.env),
                packageManagers: JSON.stringify(record.packageManagers),
                allowedDomains: JSON.stringify(record.allowedDomains),
                allowLocalBinding: record.allowLocalBinding ? 1 : 0,
                permissions: JSON.stringify(record.permissions),
                owner: record.owner ? JSON.stringify(record.owner) : null,
                keepAlive: record.keepAlive ? 1 : 0,
                desiredState: record.desiredState,
                status: record.status,
                pid: record.pid,
                bootTimeMs: record.bootTimeMs,
                restartCount: record.restartCount,
                restartFailureCount: record.restartFailureCount,
                nextRestartAt: record.nextRestartAt,
                settingsPath: record.settingsPath,
                logPath: record.logPath,
                createdAt: record.createdAt,
                updatedAt: record.updatedAt,
                lastStartedAt: record.lastStartedAt,
                lastExitedAt: record.lastExitedAt
            };

            await this.db
                .insert(processesTable)
                .values(values)
                .onConflictDoUpdate({
                    target: processesTable.id,
                    set: {
                        userId: values.userId,
                        name: values.name,
                        command: values.command,
                        cwd: values.cwd,
                        home: values.home,
                        env: values.env,
                        packageManagers: values.packageManagers,
                        allowedDomains: values.allowedDomains,
                        allowLocalBinding: values.allowLocalBinding,
                        permissions: values.permissions,
                        owner: values.owner,
                        keepAlive: values.keepAlive,
                        desiredState: values.desiredState,
                        status: values.status,
                        pid: values.pid,
                        bootTimeMs: values.bootTimeMs,
                        restartCount: values.restartCount,
                        restartFailureCount: values.restartFailureCount,
                        nextRestartAt: values.nextRestartAt,
                        settingsPath: values.settingsPath,
                        logPath: values.logPath,
                        createdAt: values.createdAt,
                        updatedAt: values.updatedAt,
                        lastStartedAt: values.lastStartedAt,
                        lastExitedAt: values.lastExitedAt
                    }
                });

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
            const loaded = await this.recordLoadById(id);
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
            ? await this.db
                  .select()
                  .from(processesTable)
                  .where(eq(processesTable.userId, options.userId))
                  .orderBy(asc(processesTable.createdAt), asc(processesTable.id))
            : await this.db
                  .select()
                  .from(processesTable)
                  .orderBy(asc(processesTable.createdAt), asc(processesTable.id));

        const parsed = rows.map((row) => recordParse(row));

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
            const current = this.recordsById.get(id) ?? (await this.recordLoadById(id));
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

            await this.db
                .update(processesTable)
                .set({
                    userId: next.userId,
                    name: next.name,
                    command: next.command,
                    cwd: next.cwd,
                    home: next.home,
                    env: JSON.stringify(next.env),
                    packageManagers: JSON.stringify(next.packageManagers),
                    allowedDomains: JSON.stringify(next.allowedDomains),
                    allowLocalBinding: next.allowLocalBinding ? 1 : 0,
                    permissions: JSON.stringify(next.permissions),
                    owner: next.owner ? JSON.stringify(next.owner) : null,
                    keepAlive: next.keepAlive ? 1 : 0,
                    desiredState: next.desiredState,
                    status: next.status,
                    pid: next.pid,
                    bootTimeMs: next.bootTimeMs,
                    restartCount: next.restartCount,
                    restartFailureCount: next.restartFailureCount,
                    nextRestartAt: next.nextRestartAt,
                    settingsPath: next.settingsPath,
                    logPath: next.logPath,
                    createdAt: next.createdAt,
                    updatedAt: next.updatedAt,
                    lastStartedAt: next.lastStartedAt,
                    lastExitedAt: next.lastExitedAt
                })
                .where(eq(processesTable.id, id));

            await this.cacheLock.inLock(() => {
                this.recordCacheSet(next);
            });
        });
    }

    async delete(id: string): Promise<boolean> {
        const lock = this.recordLockForId(id);
        return lock.inLock(async () => {
            const result = await this.db
                .delete(processesTable)
                .where(eq(processesTable.id, id))
                .returning({ id: processesTable.id });
            await this.cacheLock.inLock(() => {
                this.recordsById.delete(id);
            });
            return result.length > 0;
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

    private async recordLoadById(id: string): Promise<ProcessDbRecord | null> {
        const rows = await this.db.select().from(processesTable).where(eq(processesTable.id, id)).limit(1);
        const row = rows[0];
        if (!row) {
            return null;
        }
        return recordParse(row);
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

function recordParse(row: typeof processesTable.$inferSelect): ProcessDbRecord {
    return {
        id: row.id,
        userId: row.userId,
        name: row.name,
        command: row.command,
        cwd: row.cwd,
        home: row.home,
        env: jsonRecordParse(row.env),
        packageManagers: jsonStringArrayParse(row.packageManagers),
        allowedDomains: jsonStringArrayParse(row.allowedDomains),
        allowLocalBinding: row.allowLocalBinding === 1,
        permissions: permissionsParse(row.permissions),
        owner: ownerParse(row.owner),
        keepAlive: row.keepAlive === 1,
        desiredState: row.desiredState as ProcessDbRecord["desiredState"],
        status: row.status as ProcessDbRecord["status"],
        pid: row.pid,
        bootTimeMs: row.bootTimeMs,
        restartCount: row.restartCount,
        restartFailureCount: row.restartFailureCount,
        nextRestartAt: row.nextRestartAt,
        settingsPath: row.settingsPath,
        logPath: row.logPath,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt,
        lastStartedAt: row.lastStartedAt,
        lastExitedAt: row.lastExitedAt
    };
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
