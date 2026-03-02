import { and, asc, eq, isNull } from "drizzle-orm";
import type { DaycareDb } from "../schema.js";
import { agentsTable } from "../schema.js";
import { AsyncLock } from "../utils/lock.js";
import type { AgentDbRecord } from "./databaseTypes.js";
import { versionAdvance } from "./versionAdvance.js";

type AgentCreateInput = Omit<
    AgentDbRecord,
    | "path"
    | "kind"
    | "modelRole"
    | "connectorName"
    | "parentAgentId"
    | "foreground"
    | "name"
    | "description"
    | "systemPrompt"
    | "workspaceDir"
    | "version"
    | "validFrom"
    | "validTo"
> &
    Partial<
        Pick<
            AgentDbRecord,
            | "path"
            | "kind"
            | "modelRole"
            | "connectorName"
            | "parentAgentId"
            | "foreground"
            | "name"
            | "description"
            | "systemPrompt"
            | "workspaceDir"
            | "version"
            | "validFrom"
            | "validTo"
        >
    >;

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
            const rows = await this.db
                .select()
                .from(agentsTable)
                .where(and(eq(agentsTable.id, id), isNull(agentsTable.validTo)))
                .limit(1);
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

    async findByPath(path: string): Promise<AgentDbRecord | null> {
        const normalized = path.trim();
        if (!normalized) {
            return null;
        }
        if (this.allAgentsLoaded) {
            const match = Array.from(this.agentsById.values()).find((record) => record.path === normalized);
            return match ? agentClone(match) : null;
        }

        const rows = await this.db
            .select()
            .from(agentsTable)
            .where(and(eq(agentsTable.path, normalized), isNull(agentsTable.validTo)))
            .orderBy(asc(agentsTable.updatedAt))
            .limit(1);
        const row = rows[0];
        if (!row) {
            return null;
        }
        const parsed = agentParse(row);
        await this.cacheLock.inLock(() => {
            this.agentCacheSet(parsed);
        });
        return agentClone(parsed);
    }

    async findMany(): Promise<AgentDbRecord[]> {
        if (this.allAgentsLoaded) {
            return agentsSort(Array.from(this.agentsById.values())).map((record) => agentClone(record));
        }
        const rows = await this.db
            .select()
            .from(agentsTable)
            .where(isNull(agentsTable.validTo))
            .orderBy(asc(agentsTable.updatedAt));
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
            .where(and(eq(agentsTable.userId, userId), isNull(agentsTable.validTo)))
            .orderBy(asc(agentsTable.updatedAt));
        const parsed = rows.map((row) => agentParse(row));

        await this.cacheLock.inLock(() => {
            for (const record of parsed) {
                this.agentCacheSet(record);
            }
        });

        return parsed.map((record) => agentClone(record));
    }

    async create(record: AgentCreateInput): Promise<void> {
        await this.createLock.inLock(async () => {
            const current = this.agentsById.get(record.id) ?? (await this.agentLoadById(record.id));
            const normalized = agentCreateInputNormalize(record, current);
            let next: AgentDbRecord;
            if (!current) {
                next = {
                    ...normalized,
                    version: 1,
                    validFrom: normalized.createdAt,
                    validTo: null
                };
                await this.db.insert(agentsTable).values({
                    id: next.id,
                    version: next.version ?? 1,
                    validFrom: next.validFrom ?? next.createdAt,
                    validTo: next.validTo ?? null,
                    userId: next.userId,
                    path: next.path,
                    kind: next.kind,
                    modelRole: next.modelRole,
                    connectorName: next.connectorName,
                    parentAgentId: next.parentAgentId,
                    foreground: next.foreground,
                    name: next.name,
                    description: next.description,
                    systemPrompt: next.systemPrompt,
                    workspaceDir: next.workspaceDir,
                    nextSubIndex: next.nextSubIndex ?? 0,
                    activeSessionId: next.activeSessionId,
                    permissions: next.permissions,
                    lifecycle: next.lifecycle,
                    createdAt: next.createdAt,
                    updatedAt: next.updatedAt
                });
            } else {
                next = await this.db.transaction(async (tx) =>
                    versionAdvance<AgentDbRecord>({
                        changes: {
                            userId: normalized.userId,
                            path: normalized.path,
                            kind: normalized.kind,
                            modelRole: normalized.modelRole,
                            connectorName: normalized.connectorName,
                            parentAgentId: normalized.parentAgentId,
                            foreground: normalized.foreground,
                            name: normalized.name,
                            description: normalized.description,
                            systemPrompt: normalized.systemPrompt,
                            workspaceDir: normalized.workspaceDir,
                            nextSubIndex: normalized.nextSubIndex,
                            activeSessionId: normalized.activeSessionId,
                            permissions: normalized.permissions,
                            lifecycle: normalized.lifecycle,
                            createdAt: normalized.createdAt,
                            updatedAt: normalized.updatedAt
                        },
                        findCurrent: async () => current,
                        closeCurrent: async (row, now) => {
                            const closedRows = await tx
                                .update(agentsTable)
                                .set({ validTo: now })
                                .where(
                                    and(
                                        eq(agentsTable.id, row.id),
                                        eq(agentsTable.version, row.version ?? 1),
                                        isNull(agentsTable.validTo)
                                    )
                                )
                                .returning({ version: agentsTable.version });
                            return closedRows.length;
                        },
                        insertNext: async (row) => {
                            await tx.insert(agentsTable).values({
                                id: row.id,
                                version: row.version ?? 1,
                                validFrom: row.validFrom ?? row.createdAt,
                                validTo: row.validTo ?? null,
                                userId: row.userId,
                                path: row.path,
                                kind: row.kind,
                                modelRole: row.modelRole,
                                connectorName: row.connectorName,
                                parentAgentId: row.parentAgentId,
                                foreground: row.foreground,
                                name: row.name,
                                description: row.description,
                                systemPrompt: row.systemPrompt,
                                workspaceDir: row.workspaceDir,
                                nextSubIndex: row.nextSubIndex ?? 0,
                                activeSessionId: row.activeSessionId,
                                permissions: row.permissions,
                                lifecycle: row.lifecycle,
                                createdAt: row.createdAt,
                                updatedAt: row.updatedAt
                            });
                        }
                    })
                );
            }

            await this.cacheLock.inLock(() => {
                this.agentCacheSet(next);
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
                path: data.path ?? current.path,
                kind: data.kind ?? current.kind,
                modelRole: data.modelRole === undefined ? current.modelRole : data.modelRole,
                connectorName: data.connectorName === undefined ? current.connectorName : data.connectorName,
                parentAgentId: data.parentAgentId === undefined ? current.parentAgentId : data.parentAgentId,
                foreground: data.foreground ?? current.foreground,
                name: data.name === undefined ? current.name : data.name,
                description: data.description === undefined ? current.description : data.description,
                systemPrompt: data.systemPrompt === undefined ? current.systemPrompt : data.systemPrompt,
                workspaceDir: data.workspaceDir === undefined ? current.workspaceDir : data.workspaceDir,
                nextSubIndex: data.nextSubIndex ?? current.nextSubIndex ?? 0,
                permissions: data.permissions ?? current.permissions
            };

            if (agentRuntimeOnlyChangeIs(current, next)) {
                await this.db
                    .update(agentsTable)
                    .set({
                        lifecycle: next.lifecycle,
                        nextSubIndex: next.nextSubIndex ?? 0,
                        activeSessionId: next.activeSessionId,
                        updatedAt: next.updatedAt
                    })
                    .where(
                        and(
                            eq(agentsTable.id, current.id),
                            eq(agentsTable.version, current.version ?? 1),
                            isNull(agentsTable.validTo)
                        )
                    );
                await this.cacheLock.inLock(() => {
                    this.agentCacheSet(next);
                });
                return;
            }

            const advanced = await this.db.transaction(async (tx) =>
                versionAdvance<AgentDbRecord>({
                    changes: {
                        userId: next.userId,
                        path: next.path,
                        kind: next.kind,
                        modelRole: next.modelRole,
                        connectorName: next.connectorName,
                        parentAgentId: next.parentAgentId,
                        foreground: next.foreground,
                        name: next.name,
                        description: next.description,
                        systemPrompt: next.systemPrompt,
                        workspaceDir: next.workspaceDir,
                        nextSubIndex: next.nextSubIndex,
                        activeSessionId: next.activeSessionId,
                        permissions: next.permissions,
                        lifecycle: next.lifecycle,
                        createdAt: next.createdAt,
                        updatedAt: next.updatedAt
                    },
                    findCurrent: async () => current,
                    closeCurrent: async (row, now) => {
                        const closedRows = await tx
                            .update(agentsTable)
                            .set({ validTo: now })
                            .where(
                                and(
                                    eq(agentsTable.id, row.id),
                                    eq(agentsTable.version, row.version ?? 1),
                                    isNull(agentsTable.validTo)
                                )
                            )
                            .returning({ version: agentsTable.version });
                        return closedRows.length;
                    },
                    insertNext: async (row) => {
                        await tx.insert(agentsTable).values({
                            id: row.id,
                            version: row.version ?? 1,
                            validFrom: row.validFrom ?? row.createdAt,
                            validTo: row.validTo ?? null,
                            userId: row.userId,
                            path: row.path,
                            kind: row.kind,
                            modelRole: row.modelRole,
                            connectorName: row.connectorName,
                            parentAgentId: row.parentAgentId,
                            foreground: row.foreground,
                            name: row.name,
                            description: row.description,
                            systemPrompt: row.systemPrompt,
                            workspaceDir: row.workspaceDir,
                            nextSubIndex: row.nextSubIndex ?? 0,
                            activeSessionId: row.activeSessionId,
                            permissions: row.permissions,
                            lifecycle: row.lifecycle,
                            createdAt: row.createdAt,
                            updatedAt: row.updatedAt
                        });
                    }
                })
            );

            await this.cacheLock.inLock(() => {
                this.agentCacheSet(advanced);
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
        const rows = await this.db
            .select()
            .from(agentsTable)
            .where(and(eq(agentsTable.id, id), isNull(agentsTable.validTo)))
            .limit(1);
        const row = rows[0];
        if (!row) {
            return null;
        }
        return agentParse(row);
    }
}

function agentCreateInputNormalize(input: AgentCreateInput, current: AgentDbRecord | null): AgentDbRecord {
    const descriptor =
        typeof input.descriptor === "object" && input.descriptor ? (input.descriptor as Record<string, unknown>) : null;
    const descriptorType = typeof descriptor?.type === "string" ? descriptor.type.trim() : "";
    const kind = input.kind ?? current?.kind ?? "agent";
    const connectorNameFromDescriptor =
        descriptorType === "user" && typeof descriptor?.connector === "string" && descriptor.connector.trim().length > 0
            ? descriptor.connector.trim()
            : null;
    const parentAgentIdFromDescriptor =
        typeof descriptor?.parentAgentId === "string" && descriptor.parentAgentId.trim().length > 0
            ? descriptor.parentAgentId.trim()
            : null;
    const connectorName =
        input.connectorName === undefined
            ? (current?.connectorName ?? connectorNameFromDescriptor)
            : input.connectorName;
    const parentAgentId =
        input.parentAgentId === undefined
            ? (current?.parentAgentId ?? parentAgentIdFromDescriptor)
            : input.parentAgentId;
    const path =
        (typeof input.path === "string" ? input.path.trim() : "") ||
        current?.path ||
        agentPathDefaultResolve({
            id: input.id,
            userId: input.userId,
            kind,
            connectorName
        });
    const foreground = input.foreground ?? current?.foreground ?? (kind === "connector" || kind === "swarm");
    const modelRole =
        input.modelRole === undefined ? (current?.modelRole ?? agentModelRoleFromKind(kind)) : input.modelRole;
    const name = input.name === undefined ? (current?.name ?? null) : input.name;
    const description = input.description === undefined ? (current?.description ?? null) : input.description;
    const systemPrompt = input.systemPrompt === undefined ? (current?.systemPrompt ?? null) : input.systemPrompt;
    const workspaceDir = input.workspaceDir === undefined ? (current?.workspaceDir ?? null) : input.workspaceDir;
    return {
        ...(current ?? {}),
        ...input,
        path,
        kind,
        modelRole,
        connectorName,
        parentAgentId,
        foreground,
        name,
        description,
        systemPrompt,
        workspaceDir
    } as AgentDbRecord;
}

function agentPathDefaultResolve(input: {
    id: string;
    userId: string;
    kind: AgentDbRecord["kind"];
    connectorName: string | null;
}): string {
    const id = input.id.trim();
    const userId = input.userId.trim();
    if (!id || !userId) {
        throw new Error(`Agent path is required: ${input.id}`);
    }
    if (input.kind === "connector") {
        const connector = input.connectorName?.trim() || "user";
        return `/${userId}/${connector}`;
    }
    if (input.kind === "cron") {
        return `/${userId}/cron/${id}`;
    }
    if (input.kind === "task") {
        return `/${userId}/task/${id}`;
    }
    if (input.kind === "subuser") {
        return `/${userId}/subuser/${id}`;
    }
    if (input.kind === "sub") {
        return `/${userId}/sub/${id}`;
    }
    if (input.kind === "memory") {
        return `/${userId}/memory/${id}`;
    }
    if (input.kind === "search") {
        return `/${userId}/search/${id}`;
    }
    if (input.kind === "swarm") {
        return `/${userId}/agent/swarm`;
    }
    return `/${userId}/agent/${id}`;
}

function agentModelRoleFromKind(kind: AgentDbRecord["kind"]): AgentDbRecord["modelRole"] {
    if (kind === "connector" || kind === "agent" || kind === "subuser" || kind === "swarm") {
        return "user";
    }
    if (kind === "sub") {
        return "subagent";
    }
    if (kind === "memory") {
        return "memory";
    }
    if (kind === "search") {
        return "memorySearch";
    }
    if (kind === "task") {
        return "task";
    }
    return null;
}

function agentParse(row: typeof agentsTable.$inferSelect): AgentDbRecord {
    return {
        id: row.id,
        version: row.version ?? 1,
        validFrom: row.validFrom ?? row.createdAt,
        validTo: row.validTo ?? null,
        userId: row.userId,
        path: row.path as AgentDbRecord["path"],
        kind: row.kind as AgentDbRecord["kind"],
        modelRole: row.modelRole as AgentDbRecord["modelRole"],
        connectorName: row.connectorName,
        parentAgentId: row.parentAgentId,
        foreground: row.foreground,
        name: row.name,
        description: row.description,
        systemPrompt: row.systemPrompt,
        workspaceDir: row.workspaceDir,
        nextSubIndex: row.nextSubIndex ?? 0,
        activeSessionId: row.activeSessionId,
        permissions: jsonValueParse(row.permissions) as AgentDbRecord["permissions"],
        lifecycle: row.lifecycle as AgentDbRecord["lifecycle"],
        createdAt: row.createdAt,
        updatedAt: row.updatedAt
    };
}

function agentClone(record: AgentDbRecord): AgentDbRecord {
    return {
        ...record,
        permissions: structuredClone(record.permissions)
    };
}

function agentsSort(records: AgentDbRecord[]): AgentDbRecord[] {
    return records.slice().sort((left, right) => left.updatedAt - right.updatedAt);
}

/**
 * Resolves whether the effective update only changes runtime metadata.
 * Expects: `next` is merged from `current` and user-provided patch data.
 */
function agentRuntimeOnlyChangeIs(current: AgentDbRecord, next: AgentDbRecord): boolean {
    const lifecycleChanged = current.lifecycle !== next.lifecycle;
    const nextSubIndexChanged = (current.nextSubIndex ?? 0) !== (next.nextSubIndex ?? 0);
    const activeSessionIdChanged = (current.activeSessionId ?? null) !== (next.activeSessionId ?? null);
    if (!lifecycleChanged && !nextSubIndexChanged && !activeSessionIdChanged) {
        return false;
    }
    return (
        current.id === next.id &&
        (current.version ?? 1) === (next.version ?? 1) &&
        (current.validFrom ?? current.createdAt) === (next.validFrom ?? next.createdAt) &&
        (current.validTo ?? null) === (next.validTo ?? null) &&
        current.userId === next.userId &&
        current.path === next.path &&
        current.kind === next.kind &&
        current.modelRole === next.modelRole &&
        current.connectorName === next.connectorName &&
        current.parentAgentId === next.parentAgentId &&
        current.foreground === next.foreground &&
        current.name === next.name &&
        current.description === next.description &&
        current.systemPrompt === next.systemPrompt &&
        current.workspaceDir === next.workspaceDir &&
        agentJsonEqual(current.permissions, next.permissions) &&
        current.createdAt === next.createdAt
    );
}

function agentJsonEqual(left: unknown, right: unknown): boolean {
    return JSON.stringify(left) === JSON.stringify(right);
}

function jsonValueParse(value: unknown): unknown {
    if (typeof value === "string") {
        return JSON.parse(value);
    }
    return value;
}
