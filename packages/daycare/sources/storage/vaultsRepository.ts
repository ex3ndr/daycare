import { and, asc, desc, eq, inArray, isNull } from "drizzle-orm";
import type { Context } from "@/types";
import type { DaycareDb } from "../schema.js";
import { vaultReferencesTable, vaultsTable } from "../schema.js";
import { AsyncLock } from "../utils/lock.js";
import type { VaultDbRecord, VaultReferenceDbRecord, VaultReferenceKind } from "./databaseTypes.js";
import { vaultBodyRefs } from "./vaultBodyRefs.js";
import { vaultSlugNormalize } from "./vaultSlugNormalize.js";
import { versionAdvance } from "./versionAdvance.js";

export type VaultCreateInput = {
    id: string;
    slug: string;
    title: string;
    description: string;
    body: string;
    createdAt: number;
    updatedAt: number;
    parentId?: string | null;
    linkTargetIds?: string[];
};

export type VaultUpdateInput = {
    slug?: string;
    title?: string;
    description?: string;
    body?: string;
    createdAt?: number;
    updatedAt?: number;
    parentId?: string | null;
    linkTargetIds?: string[];
};

/**
 * Vaults repository backed by Drizzle with write-through caching.
 * Expects: schema migrations already applied for documents and document_references.
 */
export class VaultsRepository {
    private readonly db: DaycareDb;
    private readonly vaultsById = new Map<string, VaultDbRecord>();
    private readonly vaultLocks = new Map<string, AsyncLock>();
    private readonly vaultSlugScopeLocks = new Map<string, AsyncLock>();
    private readonly cacheLock = new AsyncLock();
    private readonly createLock = new AsyncLock();

    constructor(db: DaycareDb) {
        this.db = db;
    }

    async findById(ctx: Context, id: string): Promise<VaultDbRecord | null> {
        const userId = ctx.userId.trim();
        if (!userId) {
            return null;
        }
        const key = vaultKey(userId, id);
        const cached = this.vaultsById.get(key);
        if (cached) {
            return vaultClone(cached);
        }

        const lock = this.vaultLockForId(key);
        return lock.inLock(async () => {
            const existing = this.vaultsById.get(key);
            if (existing) {
                return vaultClone(existing);
            }
            const loaded = await this.vaultLoadById(userId, id);
            if (!loaded) {
                return null;
            }
            await this.cacheLock.inLock(() => {
                this.vaultCacheSet(loaded);
            });
            return vaultClone(loaded);
        });
    }

    async findAnyById(ctx: Context, id: string): Promise<VaultDbRecord | null> {
        const userId = ctx.userId.trim();
        if (!userId) {
            return null;
        }
        const key = vaultKey(userId, id);
        const cached = this.vaultsById.get(key);
        if (cached) {
            return vaultClone(cached);
        }

        const lock = this.vaultLockForId(key);
        return lock.inLock(async () => {
            const existing = this.vaultsById.get(key);
            if (existing) {
                return vaultClone(existing);
            }
            const loaded = await this.vaultLoadAnyById(userId, id);
            if (!loaded) {
                return null;
            }
            if (loaded.validTo == null) {
                await this.cacheLock.inLock(() => {
                    this.vaultCacheSet(loaded);
                });
            }
            return vaultClone(loaded);
        });
    }

    async findBySlugAndParent(ctx: Context, slug: string, parentId: string | null): Promise<VaultDbRecord | null> {
        const userId = ctx.userId.trim();
        if (!userId) {
            return null;
        }
        const normalizedSlug = vaultSlugNormalize(slug);
        return this.vaultLoadBySlugAndParent(userId, normalizedSlug, vaultIdNormalizeOptional(parentId));
    }

    async findChildren(ctx: Context, parentId: string | null): Promise<VaultDbRecord[]> {
        const userId = ctx.userId.trim();
        if (!userId) {
            return [];
        }
        const normalizedParentId = vaultIdNormalizeOptional(parentId);
        if (!normalizedParentId) {
            return this.findRoots(ctx);
        }

        const rows = await this.db
            .select({ document: vaultsTable })
            .from(vaultsTable)
            .innerJoin(
                vaultReferencesTable,
                and(
                    eq(vaultReferencesTable.userId, vaultsTable.userId),
                    eq(vaultReferencesTable.sourceId, vaultsTable.id),
                    eq(vaultReferencesTable.sourceVersion, vaultsTable.version),
                    eq(vaultReferencesTable.kind, "parent"),
                    eq(vaultReferencesTable.targetId, normalizedParentId)
                )
            )
            .where(and(eq(vaultsTable.userId, userId), isNull(vaultsTable.validTo)))
            .orderBy(asc(vaultsTable.slug), asc(vaultsTable.id));

        const parsed = rows.map((row) => vaultParse(row.document));
        await this.cacheLock.inLock(() => {
            for (const record of parsed) {
                this.vaultCacheSet(record);
            }
        });
        return parsed.map((record) => vaultClone(record));
    }

    async findRoots(ctx: Context): Promise<VaultDbRecord[]> {
        const userId = ctx.userId.trim();
        if (!userId) {
            return [];
        }

        const rows = await this.db
            .select({ document: vaultsTable })
            .from(vaultsTable)
            .leftJoin(
                vaultReferencesTable,
                and(
                    eq(vaultReferencesTable.userId, vaultsTable.userId),
                    eq(vaultReferencesTable.sourceId, vaultsTable.id),
                    eq(vaultReferencesTable.sourceVersion, vaultsTable.version),
                    eq(vaultReferencesTable.kind, "parent")
                )
            )
            .where(and(eq(vaultsTable.userId, userId), isNull(vaultsTable.validTo), isNull(vaultReferencesTable.id)))
            .orderBy(asc(vaultsTable.slug), asc(vaultsTable.id));

        const parsed = rows.map((row) => vaultParse(row.document));
        await this.cacheLock.inLock(() => {
            for (const record of parsed) {
                this.vaultCacheSet(record);
            }
        });
        return parsed.map((record) => vaultClone(record));
    }

    async findParentId(ctx: Context, id: string): Promise<string | null> {
        const userId = ctx.userId.trim();
        if (!userId) {
            return null;
        }
        const current = await this.findById(ctx, id);
        if (!current) {
            return null;
        }
        return this.vaultParentIdLoad(userId, current.id, current.version ?? 1);
    }

    async findReferences(ctx: Context, id: string): Promise<VaultReferenceDbRecord[]> {
        const userId = ctx.userId.trim();
        if (!userId) {
            return [];
        }
        const current = await this.findById(ctx, id);
        if (!current) {
            return [];
        }

        const rows = await this.db
            .select()
            .from(vaultReferencesTable)
            .where(
                and(
                    eq(vaultReferencesTable.userId, userId),
                    eq(vaultReferencesTable.sourceId, current.id),
                    eq(vaultReferencesTable.sourceVersion, current.version ?? 1)
                )
            )
            .orderBy(asc(vaultReferencesTable.kind), asc(vaultReferencesTable.targetId));

        return rows.map((row) => vaultReferenceParse(row));
    }

    async findHistory(ctx: Context, id: string): Promise<VaultDbRecord[]> {
        const userId = ctx.userId.trim();
        if (!userId) {
            return [];
        }
        const rows = await this.db
            .select()
            .from(vaultsTable)
            .where(and(eq(vaultsTable.userId, userId), eq(vaultsTable.id, id)))
            .orderBy(desc(vaultsTable.version));
        return rows.map((row) => vaultParse(row));
    }

    async create(ctx: Context, input: VaultCreateInput): Promise<VaultDbRecord> {
        return this.createLock.inLock(async () => {
            const userId = ctx.userId.trim();
            if (!userId) {
                throw new Error("Vault userId is required.");
            }

            const normalized = vaultCreateNormalize(input);
            const key = vaultKey(userId, normalized.id);
            const existing = this.vaultsById.get(key) ?? (await this.vaultLoadAnyById(userId, normalized.id));
            if (existing) {
                throw new Error(`Vault id already exists: ${normalized.id}`);
            }

            const refs = await this.vaultReferencesResolve(ctx, {
                userId,
                vaultId: normalized.id,
                parentId: normalized.parentId,
                body: normalized.body,
                linkTargetIds: normalized.linkTargetIds ?? []
            });

            const slugScopeLock = this.vaultSlugScopeLockFor(userId, refs.parentId, normalized.slug);
            return slugScopeLock.inLock(async () => {
                const clash = await this.vaultLoadBySlugAndParent(userId, normalized.slug, refs.parentId);
                if (clash) {
                    throw new Error(`Vault slug is already used under the same parent: ${normalized.slug}`);
                }

                const next: VaultDbRecord = {
                    id: normalized.id,
                    userId,
                    version: 1,
                    validFrom: normalized.createdAt,
                    validTo: null,
                    slug: normalized.slug,
                    title: normalized.title,
                    description: normalized.description,
                    body: normalized.body,
                    createdAt: normalized.createdAt,
                    updatedAt: normalized.updatedAt
                };

                await this.db.transaction(async (tx) => {
                    await tx.insert(vaultsTable).values(vaultRowInsert(next));
                    const refRows = vaultReferenceRowsBuild(userId, next.id, next.version ?? 1, refs);
                    if (refRows.length > 0) {
                        await tx.insert(vaultReferencesTable).values(refRows);
                    }
                });

                await this.cacheLock.inLock(() => {
                    this.vaultCacheSet(next);
                });

                return vaultClone(next);
            });
        });
    }

    async update(ctx: Context, id: string, input: VaultUpdateInput): Promise<VaultDbRecord> {
        const userId = ctx.userId.trim();
        if (!userId) {
            throw new Error("Vault userId is required.");
        }
        const key = vaultKey(userId, id);
        const lock = this.vaultLockForId(key);

        return lock.inLock(async () => {
            const current = this.vaultsById.get(key) ?? (await this.vaultLoadById(userId, id));
            if (!current) {
                throw new Error(`Vault not found: ${id}`);
            }

            const currentRefs = await this.vaultReferenceSnapshotLoad(userId, current.id, current.version ?? 1);
            const nextParentId =
                input.parentId === undefined ? currentRefs.parentId : vaultIdNormalizeOptional(input.parentId);
            const nextLinks =
                input.linkTargetIds === undefined ? currentRefs.linkTargetIds : vaultIdsNormalize(input.linkTargetIds);
            const nextSlug = input.slug === undefined ? current.slug : vaultSlugNormalize(input.slug);

            const merged: VaultDbRecord = {
                ...current,
                slug: nextSlug,
                title: input.title?.trim() || current.title,
                description: input.description === undefined ? current.description : input.description.trim(),
                body: input.body === undefined ? current.body : input.body,
                createdAt: current.createdAt,
                updatedAt: Date.now()
            };

            const refs = await this.vaultReferencesResolve(ctx, {
                userId,
                vaultId: current.id,
                parentId: nextParentId,
                body: merged.body,
                linkTargetIds: nextLinks
            });

            const slugScopeLock = this.vaultSlugScopeLockFor(userId, refs.parentId, merged.slug);
            return slugScopeLock.inLock(async () => {
                const clash = await this.vaultLoadBySlugAndParent(userId, merged.slug, refs.parentId);
                if (clash && clash.id !== current.id) {
                    throw new Error(`Vault slug is already used under the same parent: ${merged.slug}`);
                }

                const advanced = await this.db.transaction(async (tx) => {
                    const now = Date.now();
                    const next = await versionAdvance<VaultDbRecord>({
                        now,
                        changes: {
                            userId,
                            slug: merged.slug,
                            title: merged.title,
                            description: merged.description,
                            body: merged.body,
                            createdAt: current.createdAt,
                            updatedAt: now
                        },
                        findCurrent: async () => current,
                        closeCurrent: async (row, now) => {
                            const closedRows = await tx
                                .update(vaultsTable)
                                .set({ validTo: now })
                                .where(
                                    and(
                                        eq(vaultsTable.userId, row.userId),
                                        eq(vaultsTable.id, row.id),
                                        eq(vaultsTable.version, row.version ?? 1),
                                        isNull(vaultsTable.validTo)
                                    )
                                )
                                .returning({ version: vaultsTable.version });
                            return closedRows.length;
                        },
                        insertNext: async (row) => {
                            await tx.insert(vaultsTable).values(vaultRowInsert(row));
                        }
                    });

                    const refRows = vaultReferenceRowsBuild(userId, next.id, next.version ?? 1, refs);
                    if (refRows.length > 0) {
                        await tx.insert(vaultReferencesTable).values(refRows);
                    }
                    return next;
                });

                await this.cacheLock.inLock(() => {
                    this.vaultCacheSet(advanced);
                });

                return vaultClone(advanced);
            });
        });
    }

    async delete(ctx: Context, id: string): Promise<boolean> {
        const userId = ctx.userId.trim();
        if (!userId) {
            return false;
        }
        const key = vaultKey(userId, id);
        const lock = this.vaultLockForId(key);

        return lock.inLock(async () => {
            const current = this.vaultsById.get(key) ?? (await this.vaultLoadById(userId, id));
            if (!current) {
                return false;
            }

            const blockers = await this.db
                .select({ sourceId: vaultReferencesTable.sourceId })
                .from(vaultReferencesTable)
                .innerJoin(
                    vaultsTable,
                    and(
                        eq(vaultReferencesTable.userId, vaultsTable.userId),
                        eq(vaultReferencesTable.sourceId, vaultsTable.id),
                        eq(vaultReferencesTable.sourceVersion, vaultsTable.version)
                    )
                )
                .where(
                    and(
                        eq(vaultReferencesTable.userId, userId),
                        eq(vaultReferencesTable.targetId, current.id),
                        inArray(vaultReferencesTable.kind, ["parent", "link"]),
                        isNull(vaultsTable.validTo)
                    )
                )
                .limit(1);
            if (blockers.length > 0) {
                throw new Error(`Vault has active references and cannot be deleted: ${id}`);
            }

            const now = Date.now();
            await this.db
                .update(vaultsTable)
                .set({ validTo: now })
                .where(
                    and(
                        eq(vaultsTable.userId, current.userId),
                        eq(vaultsTable.id, current.id),
                        eq(vaultsTable.version, current.version ?? 1),
                        isNull(vaultsTable.validTo)
                    )
                );

            await this.cacheLock.inLock(() => {
                this.vaultsById.delete(key);
            });

            return true;
        });
    }

    private async vaultReferencesResolve(
        ctx: Context,
        input: {
            userId: string;
            vaultId: string;
            parentId: string | null;
            body: string;
            linkTargetIds: string[];
        }
    ): Promise<VaultReferenceSnapshot> {
        if (input.parentId === input.vaultId) {
            throw new Error(`Vault entry cannot be its own parent: ${input.vaultId}`);
        }

        if (input.parentId) {
            await this.vaultTargetEnsureExists(input.userId, input.parentId);
            await this.vaultParentCycleEnsure(input.userId, input.vaultId, input.parentId);
        }

        for (const targetId of input.linkTargetIds) {
            await this.vaultTargetEnsureExists(input.userId, targetId);
        }

        const bodyTargetIds = await vaultBodyRefs(input.body, ctx, this);

        return {
            parentId: input.parentId,
            linkTargetIds: input.linkTargetIds,
            bodyTargetIds
        };
    }

    private async vaultTargetEnsureExists(userId: string, id: string): Promise<void> {
        const target = await this.vaultLoadById(userId, id);
        if (!target) {
            throw new Error(`Vault target not found: ${id}`);
        }
    }

    private async vaultReferenceSnapshotLoad(
        userId: string,
        sourceId: string,
        sourceVersion: number
    ): Promise<VaultReferenceSnapshot> {
        const rows = await this.db
            .select()
            .from(vaultReferencesTable)
            .where(
                and(
                    eq(vaultReferencesTable.userId, userId),
                    eq(vaultReferencesTable.sourceId, sourceId),
                    eq(vaultReferencesTable.sourceVersion, sourceVersion),
                    inArray(vaultReferencesTable.kind, ["parent", "link"])
                )
            )
            .orderBy(asc(vaultReferencesTable.kind), asc(vaultReferencesTable.targetId));

        let parentId: string | null = null;
        const links: string[] = [];
        for (const row of rows) {
            if (row.kind === "parent") {
                parentId = row.targetId;
            }
            if (row.kind === "link") {
                links.push(row.targetId);
            }
        }

        return {
            parentId,
            linkTargetIds: links,
            bodyTargetIds: []
        };
    }

    private async vaultLoadById(userId: string, id: string): Promise<VaultDbRecord | null> {
        const rows = await this.db
            .select()
            .from(vaultsTable)
            .where(and(eq(vaultsTable.userId, userId), eq(vaultsTable.id, id), isNull(vaultsTable.validTo)))
            .limit(1);
        const row = rows[0];
        if (!row) {
            return null;
        }
        return vaultParse(row);
    }

    private async vaultLoadAnyById(userId: string, id: string): Promise<VaultDbRecord | null> {
        const rows = await this.db
            .select()
            .from(vaultsTable)
            .where(and(eq(vaultsTable.userId, userId), eq(vaultsTable.id, id)))
            .orderBy(desc(vaultsTable.version))
            .limit(1);
        const row = rows[0];
        if (!row) {
            return null;
        }
        return vaultParse(row);
    }

    private async vaultLoadBySlugAndParent(
        userId: string,
        slug: string,
        parentId: string | null
    ): Promise<VaultDbRecord | null> {
        if (parentId) {
            const rows = await this.db
                .select({ document: vaultsTable })
                .from(vaultsTable)
                .innerJoin(
                    vaultReferencesTable,
                    and(
                        eq(vaultReferencesTable.userId, vaultsTable.userId),
                        eq(vaultReferencesTable.sourceId, vaultsTable.id),
                        eq(vaultReferencesTable.sourceVersion, vaultsTable.version),
                        eq(vaultReferencesTable.kind, "parent"),
                        eq(vaultReferencesTable.targetId, parentId)
                    )
                )
                .where(and(eq(vaultsTable.userId, userId), eq(vaultsTable.slug, slug), isNull(vaultsTable.validTo)))
                .orderBy(asc(vaultsTable.updatedAt), asc(vaultsTable.id))
                .limit(1);
            const row = rows[0];
            if (!row) {
                return null;
            }
            const parsed = vaultParse(row.document);
            await this.cacheLock.inLock(() => {
                this.vaultCacheSet(parsed);
            });
            return vaultClone(parsed);
        }

        const rows = await this.db
            .select({ document: vaultsTable })
            .from(vaultsTable)
            .leftJoin(
                vaultReferencesTable,
                and(
                    eq(vaultReferencesTable.userId, vaultsTable.userId),
                    eq(vaultReferencesTable.sourceId, vaultsTable.id),
                    eq(vaultReferencesTable.sourceVersion, vaultsTable.version),
                    eq(vaultReferencesTable.kind, "parent")
                )
            )
            .where(
                and(
                    eq(vaultsTable.userId, userId),
                    eq(vaultsTable.slug, slug),
                    isNull(vaultsTable.validTo),
                    isNull(vaultReferencesTable.id)
                )
            )
            .orderBy(asc(vaultsTable.updatedAt), asc(vaultsTable.id))
            .limit(1);
        const row = rows[0];
        if (!row) {
            return null;
        }
        const parsed = vaultParse(row.document);
        await this.cacheLock.inLock(() => {
            this.vaultCacheSet(parsed);
        });
        return vaultClone(parsed);
    }

    private async vaultParentIdLoad(userId: string, sourceId: string, sourceVersion: number): Promise<string | null> {
        const rows = await this.db
            .select({ targetId: vaultReferencesTable.targetId })
            .from(vaultReferencesTable)
            .where(
                and(
                    eq(vaultReferencesTable.userId, userId),
                    eq(vaultReferencesTable.sourceId, sourceId),
                    eq(vaultReferencesTable.sourceVersion, sourceVersion),
                    eq(vaultReferencesTable.kind, "parent")
                )
            )
            .limit(1);
        const row = rows[0];
        if (!row) {
            return null;
        }
        return row.targetId;
    }

    private async vaultParentCycleEnsure(userId: string, vaultId: string, parentId: string): Promise<void> {
        const visited = new Set<string>();
        let currentId: string | null = parentId;
        while (currentId) {
            if (currentId === vaultId || visited.has(currentId)) {
                throw new Error(`Vault parent cycle detected for ${vaultId}.`);
            }
            visited.add(currentId);
            const parent = await this.vaultLoadById(userId, currentId);
            if (!parent) {
                throw new Error(`Vault target not found: ${currentId}`);
            }
            currentId = await this.vaultParentIdLoad(userId, parent.id, parent.version ?? 1);
        }
    }

    private vaultCacheSet(record: VaultDbRecord): void {
        this.vaultsById.set(vaultKey(record.userId, record.id), vaultClone(record));
    }

    private vaultLockForId(key: string): AsyncLock {
        const existing = this.vaultLocks.get(key);
        if (existing) {
            return existing;
        }
        const lock = new AsyncLock();
        this.vaultLocks.set(key, lock);
        return lock;
    }

    private vaultSlugScopeLockFor(userId: string, parentId: string | null, slug: string): AsyncLock {
        const key = vaultSlugScopeKey(userId, parentId, slug);
        const existing = this.vaultSlugScopeLocks.get(key);
        if (existing) {
            return existing;
        }
        const lock = new AsyncLock();
        this.vaultSlugScopeLocks.set(key, lock);
        return lock;
    }
}

function vaultCreateNormalize(input: VaultCreateInput): VaultCreateInput & { parentId: string | null } {
    const normalizedId = input.id.trim();
    if (!normalizedId) {
        throw new Error("Vault id is required.");
    }

    const normalizedSlug = vaultSlugNormalize(input.slug);

    const normalizedTitle = input.title.trim();
    if (!normalizedTitle) {
        throw new Error("Vault title is required.");
    }

    const normalizedDescription = input.description.trim();

    return {
        ...input,
        id: normalizedId,
        slug: normalizedSlug,
        title: normalizedTitle,
        description: normalizedDescription,
        body: input.body,
        parentId: vaultIdNormalizeOptional(input.parentId),
        linkTargetIds: vaultIdsNormalize(input.linkTargetIds)
    };
}

function vaultParse(row: typeof vaultsTable.$inferSelect): VaultDbRecord {
    return {
        id: row.id,
        userId: row.userId,
        version: row.version ?? 1,
        validFrom: row.validFrom ?? row.createdAt,
        validTo: row.validTo ?? null,
        slug: row.slug,
        title: row.title,
        description: row.description,
        body: row.body,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt
    };
}

function vaultReferenceParse(row: typeof vaultReferencesTable.$inferSelect): VaultReferenceDbRecord {
    return {
        id: row.id,
        userId: row.userId,
        sourceId: row.sourceId,
        sourceVersion: row.sourceVersion,
        targetId: row.targetId,
        kind: row.kind as VaultReferenceKind
    };
}

function vaultClone(record: VaultDbRecord): VaultDbRecord {
    return { ...record };
}

function vaultReferenceRowsBuild(
    userId: string,
    sourceId: string,
    sourceVersion: number,
    refs: VaultReferenceSnapshot
): Array<typeof vaultReferencesTable.$inferInsert> {
    const rows: Array<typeof vaultReferencesTable.$inferInsert> = [];
    const seen = new Set<string>();

    const push = (kind: VaultReferenceKind, targetId: string | null): void => {
        if (!targetId) {
            return;
        }
        const normalizedTargetId = targetId.trim();
        if (!normalizedTargetId) {
            return;
        }
        const key = `${kind}\u0000${normalizedTargetId}`;
        if (seen.has(key)) {
            return;
        }
        seen.add(key);
        rows.push({
            userId,
            sourceId,
            sourceVersion,
            targetId: normalizedTargetId,
            kind
        });
    };

    push("parent", refs.parentId);
    for (const targetId of refs.linkTargetIds) {
        push("link", targetId);
    }
    for (const targetId of refs.bodyTargetIds) {
        push("body", targetId);
    }

    return rows;
}

function vaultRowInsert(record: VaultDbRecord): typeof vaultsTable.$inferInsert {
    return {
        id: record.id,
        userId: record.userId,
        version: record.version ?? 1,
        validFrom: record.validFrom ?? record.createdAt,
        validTo: record.validTo ?? null,
        slug: record.slug,
        title: record.title,
        description: record.description,
        body: record.body,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt
    };
}

function vaultKey(userId: string, id: string): string {
    return `${userId}\u0000${id}`;
}

function vaultSlugScopeKey(userId: string, parentId: string | null, slug: string): string {
    return `${userId}\u0000${parentId ?? "__root__"}\u0000${slug}`;
}

function vaultIdNormalizeOptional(id: string | null | undefined): string | null {
    if (id === undefined || id === null) {
        return null;
    }
    const normalized = id.trim();
    return normalized.length > 0 ? normalized : null;
}

function vaultIdsNormalize(ids: string[] | undefined): string[] {
    const values = ids ?? [];
    const result: string[] = [];
    const seen = new Set<string>();
    for (const value of values) {
        const normalized = value.trim();
        if (!normalized || seen.has(normalized)) {
            continue;
        }
        seen.add(normalized);
        result.push(normalized);
    }
    return result;
}

type VaultReferenceSnapshot = {
    parentId: string | null;
    linkTargetIds: string[];
    bodyTargetIds: string[];
};
