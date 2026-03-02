import { and, asc, eq, isNull } from "drizzle-orm";
import type { Context } from "@/types";
import type { DaycareDb } from "../schema.js";
import { processesTable } from "../schema.js";
import { AsyncLock } from "../utils/lock.js";
import type { ProcessDbRecord, ProcessOwnerDbRecord } from "./databaseTypes.js";
import { versionAdvance } from "./versionAdvance.js";

export type ProcessesFindManyOptions = {
    ownerId?: string;
    ownerType?: ProcessOwnerDbRecord["type"];
};

type ProcessesFindAllOptions = ProcessesFindManyOptions & {
    userId?: string;
};

export type ProcessesRuntimeUpdate = Partial<
    Pick<
        ProcessDbRecord,
        | "desiredState"
        | "status"
        | "pid"
        | "bootTimeMs"
        | "restartCount"
        | "restartFailureCount"
        | "nextRestartAt"
        | "settingsPath"
        | "logPath"
        | "createdAt"
        | "updatedAt"
        | "lastStartedAt"
        | "lastExitedAt"
    >
>;

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
            const current = this.recordsById.get(record.id) ?? (await this.recordLoadById(record.id));
            let next: ProcessDbRecord;
            if (!current) {
                next = {
                    ...record,
                    version: 1,
                    validFrom: record.createdAt,
                    validTo: null
                };
                await this.db.insert(processesTable).values(processRowInsert(next));
            } else {
                const resolved = processRecordCurrentResolve(current, record);
                next = await this.db.transaction(async (tx) =>
                    versionAdvance<ProcessDbRecord>({
                        changes: processVersionChanges(resolved),
                        findCurrent: async () => current,
                        closeCurrent: async (row, now) => {
                            const closedRows = await tx
                                .update(processesTable)
                                .set({ validTo: now })
                                .where(
                                    and(
                                        eq(processesTable.id, row.id),
                                        eq(processesTable.version, row.version ?? 1),
                                        isNull(processesTable.validTo)
                                    )
                                )
                                .returning({ version: processesTable.version });
                            return closedRows.length;
                        },
                        insertNext: async (row) => {
                            await tx.insert(processesTable).values(processRowInsert(row));
                        }
                    })
                );
            }

            await this.cacheLock.inLock(() => {
                this.recordCacheSet(next);
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
                  .where(and(eq(processesTable.userId, options.userId), isNull(processesTable.validTo)))
                  .orderBy(asc(processesTable.createdAt), asc(processesTable.id))
            : await this.db
                  .select()
                  .from(processesTable)
                  .where(isNull(processesTable.validTo))
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

            const next = processRecordMerge(current, data);
            const advanced = await this.db.transaction(async (tx) =>
                versionAdvance<ProcessDbRecord>({
                    changes: processVersionChanges(next),
                    findCurrent: async () => current,
                    closeCurrent: async (row, now) => {
                        const closedRows = await tx
                            .update(processesTable)
                            .set({ validTo: now })
                            .where(
                                and(
                                    eq(processesTable.id, row.id),
                                    eq(processesTable.version, row.version ?? 1),
                                    isNull(processesTable.validTo)
                                )
                            )
                            .returning({ version: processesTable.version });
                        return closedRows.length;
                    },
                    insertNext: async (row) => {
                        await tx.insert(processesTable).values(processRowInsert(row));
                    }
                })
            );

            await this.cacheLock.inLock(() => {
                this.recordCacheSet(advanced);
            });
        });
    }

    async updateRuntime(id: string, data: ProcessesRuntimeUpdate): Promise<void> {
        const lock = this.recordLockForId(id);
        await lock.inLock(async () => {
            const current = this.recordsById.get(id) ?? (await this.recordLoadById(id));
            if (!current) {
                throw new Error(`Process not found: ${id}`);
            }
            const next = processRuntimeMerge(current, data);
            await this.db
                .update(processesTable)
                .set(processRowRuntimeUpdate(next))
                .where(
                    and(
                        eq(processesTable.id, current.id),
                        eq(processesTable.version, current.version ?? 1),
                        isNull(processesTable.validTo)
                    )
                );
            await this.cacheLock.inLock(() => {
                this.recordCacheSet(next);
            });
        });
    }

    async delete(id: string): Promise<boolean> {
        const lock = this.recordLockForId(id);
        return lock.inLock(async () => {
            const current = this.recordsById.get(id) ?? (await this.recordLoadById(id));
            if (!current) {
                return false;
            }
            await this.db
                .update(processesTable)
                .set({ validTo: Date.now() })
                .where(
                    and(
                        eq(processesTable.id, current.id),
                        eq(processesTable.version, current.version ?? 1),
                        isNull(processesTable.validTo)
                    )
                );
            await this.cacheLock.inLock(() => {
                this.recordsById.delete(id);
            });
            return true;
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
        const rows = await this.db
            .select()
            .from(processesTable)
            .where(and(eq(processesTable.id, id), isNull(processesTable.validTo)))
            .limit(1);
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
        version: row.version ?? 1,
        validFrom: row.validFrom ?? row.createdAt,
        validTo: row.validTo ?? null,
        userId: row.userId,
        name: row.name,
        command: row.command,
        cwd: row.cwd,
        home: row.home,
        env: jsonRecordParse(row.env),
        packageManagers: jsonStringArrayParse(row.packageManagers),
        allowedDomains: jsonStringArrayParse(row.allowedDomains),
        allowLocalBinding: row.allowLocalBinding,
        permissions: permissionsParse(row.permissions),
        owner: ownerParse(row.owner),
        keepAlive: row.keepAlive,
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

function processRecordCurrentResolve(current: ProcessDbRecord, record: ProcessDbRecord): ProcessDbRecord {
    return {
        ...record,
        id: current.id,
        version: current.version ?? 1,
        validFrom: current.validFrom ?? current.createdAt,
        validTo: current.validTo ?? null
    };
}

function processVersionChanges(
    record: ProcessDbRecord
): Omit<ProcessDbRecord, "id" | "version" | "validFrom" | "validTo"> {
    return {
        userId: record.userId,
        name: record.name,
        command: record.command,
        cwd: record.cwd,
        home: record.home,
        env: record.env,
        packageManagers: record.packageManagers,
        allowedDomains: record.allowedDomains,
        allowLocalBinding: record.allowLocalBinding,
        permissions: record.permissions,
        owner: record.owner,
        keepAlive: record.keepAlive,
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
}

function processRowInsert(record: ProcessDbRecord): typeof processesTable.$inferInsert {
    return {
        id: record.id,
        version: record.version ?? 1,
        validFrom: record.validFrom ?? record.createdAt,
        validTo: record.validTo ?? null,
        ...processRowUpdate(record)
    };
}

function processRowUpdate(
    record: ProcessDbRecord
): Omit<typeof processesTable.$inferInsert, "id" | "version" | "validFrom" | "validTo"> {
    return {
        userId: record.userId,
        name: record.name,
        command: record.command,
        cwd: record.cwd,
        home: record.home,
        env: record.env,
        packageManagers: record.packageManagers,
        allowedDomains: record.allowedDomains,
        allowLocalBinding: record.allowLocalBinding,
        permissions: record.permissions,
        owner: record.owner,
        keepAlive: record.keepAlive,
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
}

function processRowRuntimeUpdate(
    record: ProcessDbRecord
): Pick<
    typeof processesTable.$inferInsert,
    | "desiredState"
    | "status"
    | "pid"
    | "bootTimeMs"
    | "restartCount"
    | "restartFailureCount"
    | "nextRestartAt"
    | "settingsPath"
    | "logPath"
    | "createdAt"
    | "updatedAt"
    | "lastStartedAt"
    | "lastExitedAt"
> {
    return {
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
}

function processRecordMerge(current: ProcessDbRecord, data: Partial<ProcessDbRecord>): ProcessDbRecord {
    return {
        ...current,
        ...data,
        id: current.id,
        version: current.version ?? 1,
        validFrom: current.validFrom ?? current.createdAt,
        validTo: current.validTo ?? null,
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
}

function processRuntimeMerge(current: ProcessDbRecord, data: ProcessesRuntimeUpdate): ProcessDbRecord {
    return {
        ...current,
        id: current.id,
        version: current.version ?? 1,
        validFrom: current.validFrom ?? current.createdAt,
        validTo: current.validTo ?? null,
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
}

function processesSort(records: ProcessDbRecord[]): ProcessDbRecord[] {
    return records.slice().sort((left, right) => left.createdAt - right.createdAt || left.id.localeCompare(right.id));
}

function jsonRecordParse(raw: unknown): Record<string, string> {
    try {
        const parsed = jsonValueParse(raw);
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

function jsonStringArrayParse(raw: unknown): string[] {
    try {
        const parsed = jsonValueParse(raw);
        if (!Array.isArray(parsed)) {
            return [];
        }
        return parsed.filter((entry): entry is string => typeof entry === "string");
    } catch {
        return [];
    }
}

function permissionsParse(raw: unknown): ProcessDbRecord["permissions"] {
    try {
        const parsed = jsonValueParse(raw) as Partial<ProcessDbRecord["permissions"]>;
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

function ownerParse(raw: unknown | null): ProcessOwnerDbRecord | null {
    if (!raw) {
        return null;
    }
    try {
        const parsed = jsonValueParse(raw) as { type?: unknown; id?: unknown };
        if (parsed.type !== "plugin" || typeof parsed.id !== "string" || !parsed.id.trim()) {
            return null;
        }
        return { type: "plugin", id: parsed.id.trim() };
    } catch {
        return null;
    }
}

function jsonValueParse(raw: unknown): unknown {
    if (typeof raw === "string") {
        return JSON.parse(raw);
    }
    return raw;
}
