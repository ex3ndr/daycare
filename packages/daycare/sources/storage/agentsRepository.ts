import { and, asc, eq, isNull } from "drizzle-orm";
import type { DaycareDb } from "../schema.js";
import { agentsTable } from "../schema.js";
import { AsyncLock } from "../util/lock.js";
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
                    foreground: next.foreground ? 1 : 0,
                    name: next.name,
                    description: next.description,
                    systemPrompt: next.systemPrompt,
                    workspaceDir: next.workspaceDir,
                    nextSubIndex: next.nextSubIndex ?? 0,
                    activeSessionId: next.activeSessionId,
                    permissions: JSON.stringify(next.permissions),
                    tokens: next.tokens ? JSON.stringify(next.tokens) : null,
                    stats: JSON.stringify(next.stats),
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
                            tokens: normalized.tokens,
                            stats: normalized.stats,
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
                                foreground: row.foreground ? 1 : 0,
                                name: row.name,
                                description: row.description,
                                systemPrompt: row.systemPrompt,
                                workspaceDir: row.workspaceDir,
                                nextSubIndex: row.nextSubIndex ?? 0,
                                activeSessionId: row.activeSessionId,
                                permissions: JSON.stringify(row.permissions),
                                tokens: row.tokens ? JSON.stringify(row.tokens) : null,
                                stats: JSON.stringify(row.stats),
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
                permissions: data.permissions ?? current.permissions,
                stats: data.stats ?? current.stats,
                tokens: data.tokens === undefined ? current.tokens : data.tokens
            };

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
                        tokens: next.tokens,
                        stats: next.stats,
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
                            foreground: row.foreground ? 1 : 0,
                            name: row.name,
                            description: row.description,
                            systemPrompt: row.systemPrompt,
                            workspaceDir: row.workspaceDir,
                            nextSubIndex: row.nextSubIndex ?? 0,
                            activeSessionId: row.activeSessionId,
                            permissions: JSON.stringify(row.permissions),
                            tokens: row.tokens ? JSON.stringify(row.tokens) : null,
                            stats: JSON.stringify(row.stats),
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
    const legacyType = agentLegacyTypeResolve(input);
    const path =
        (typeof input.path === "string" ? input.path.trim() : "") ||
        current?.path ||
        agentLegacyPathResolve({
            id: input.id,
            userId: input.userId,
            type: legacyType,
            descriptor: input.descriptor
        });
    if (!path) {
        throw new Error(`Agent path is required: ${input.id}`);
    }
    const kind = input.kind ?? current?.kind ?? agentKindFromLegacyType(legacyType);
    if (!kind) {
        throw new Error(`Agent kind is required: ${input.id}`);
    }
    const foreground = input.foreground ?? current?.foreground ?? (legacyType === "user" || legacyType === "swarm");
    const modelRole =
        input.modelRole === undefined ? (current?.modelRole ?? agentModelRoleFromKind(kind)) : input.modelRole;
    const connectorName =
        input.connectorName === undefined
            ? (current?.connectorName ?? agentLegacyConnectorNameResolve(input.descriptor, legacyType))
            : input.connectorName;
    const parentAgentId =
        input.parentAgentId === undefined
            ? (current?.parentAgentId ?? agentLegacyParentAgentIdResolve(input.descriptor))
            : input.parentAgentId;
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

function agentLegacyTypeResolve(input: AgentCreateInput): string | null {
    if (typeof input.type === "string" && input.type.trim().length > 0) {
        return input.type.trim();
    }
    if (typeof input.descriptor !== "object" || !input.descriptor) {
        return null;
    }
    const value = input.descriptor as { type?: unknown };
    return typeof value.type === "string" ? value.type : null;
}

function agentKindFromLegacyType(type: string | null): AgentDbRecord["kind"] {
    if (type === "user") {
        return "connector";
    }
    if (type === "cron") {
        return "cron";
    }
    if (type === "task") {
        return "task";
    }
    if (type === "subuser") {
        return "subuser";
    }
    if (type === "system") {
        return "system";
    }
    if (type === "subagent") {
        return "sub";
    }
    if (type === "memory-agent") {
        return "memory";
    }
    if (type === "memory-search") {
        return "search";
    }
    if (type === "swarm") {
        return "swarm";
    }
    return "agent";
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

function agentLegacyPathResolve(input: {
    id: string;
    userId: string;
    type: string | null;
    descriptor: unknown;
}): string {
    const type = input.type;
    const descriptor = (typeof input.descriptor === "object" && input.descriptor ? input.descriptor : {}) as Record<
        string,
        unknown
    >;
    const descriptorId = typeof descriptor.id === "string" && descriptor.id.length > 0 ? descriptor.id : input.id;
    if (type === "system") {
        const tag = typeof descriptor.tag === "string" && descriptor.tag.length > 0 ? descriptor.tag : descriptorId;
        return `/system/${tag}`;
    }
    if (type === "user") {
        const connector =
            typeof descriptor.connector === "string" && descriptor.connector.length > 0 ? descriptor.connector : "user";
        return `/${input.userId}/${connector}`;
    }
    if (type === "cron") {
        return `/${input.userId}/cron/${descriptorId}`;
    }
    if (type === "task") {
        return `/${input.userId}/task/${descriptorId}`;
    }
    if (type === "subagent") {
        return `/${input.userId}/sub/${descriptorId}`;
    }
    if (type === "memory-agent") {
        return `/${input.userId}/memory/${descriptorId}`;
    }
    if (type === "memory-search") {
        return `/${input.userId}/search/${descriptorId}`;
    }
    if (type === "permanent") {
        const name = typeof descriptor.name === "string" && descriptor.name.length > 0 ? descriptor.name : descriptorId;
        return `/${input.userId}/agent/${name}`;
    }
    if (type === "swarm") {
        return `/${input.userId}/agent/swarm`;
    }
    return `/${input.userId}/agent/${descriptorId}`;
}

function agentLegacyConnectorNameResolve(descriptorInput: unknown, type: string | null): string | null {
    if (type !== "user") {
        return null;
    }
    if (typeof descriptorInput !== "object" || !descriptorInput) {
        return null;
    }
    const descriptor = descriptorInput as Record<string, unknown>;
    const connector = descriptor.connector;
    return typeof connector === "string" && connector.trim().length > 0 ? connector.trim() : null;
}

function agentLegacyParentAgentIdResolve(descriptorInput: unknown): string | null {
    if (typeof descriptorInput !== "object" || !descriptorInput) {
        return null;
    }
    const descriptor = descriptorInput as Record<string, unknown>;
    const parentAgentId = descriptor.parentAgentId;
    return typeof parentAgentId === "string" && parentAgentId.trim().length > 0 ? parentAgentId.trim() : null;
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
        foreground: row.foreground > 0,
        name: row.name,
        description: row.description,
        systemPrompt: row.systemPrompt,
        workspaceDir: row.workspaceDir,
        nextSubIndex: row.nextSubIndex ?? 0,
        activeSessionId: row.activeSessionId,
        permissions: JSON.parse(row.permissions) as AgentDbRecord["permissions"],
        tokens: row.tokens ? (JSON.parse(row.tokens) as NonNullable<AgentDbRecord["tokens"]>) : null,
        stats: JSON.parse(row.stats) as AgentDbRecord["stats"],
        lifecycle: row.lifecycle as AgentDbRecord["lifecycle"],
        createdAt: row.createdAt,
        updatedAt: row.updatedAt
    };
}

function agentClone(record: AgentDbRecord): AgentDbRecord {
    return {
        ...record,
        permissions: JSON.parse(JSON.stringify(record.permissions)) as AgentDbRecord["permissions"],
        stats: JSON.parse(JSON.stringify(record.stats)) as AgentDbRecord["stats"],
        tokens: record.tokens ? (JSON.parse(JSON.stringify(record.tokens)) as AgentDbRecord["tokens"]) : null
    };
}

function agentsSort(records: AgentDbRecord[]): AgentDbRecord[] {
    return records.slice().sort((left, right) => left.updatedAt - right.updatedAt);
}
