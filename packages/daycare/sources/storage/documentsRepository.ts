import { and, asc, desc, eq, inArray, isNull } from "drizzle-orm";
import type { Context } from "@/types";
import type { DaycareDb } from "../schema.js";
import { documentReferencesTable, documentsTable } from "../schema.js";
import { AsyncLock } from "../util/lock.js";
import type { DocumentDbRecord, DocumentReferenceDbRecord, DocumentReferenceKind } from "./databaseTypes.js";
import { documentBodyRefs } from "./documentBodyRefs.js";
import { versionAdvance } from "./versionAdvance.js";

export type DocumentCreateInput = {
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

export type DocumentUpdateInput = {
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
 * Documents repository backed by Drizzle with write-through caching.
 * Expects: schema migrations already applied for documents and document_references.
 */
export class DocumentsRepository {
    private readonly db: DaycareDb;
    private readonly documentsById = new Map<string, DocumentDbRecord>();
    private readonly documentLocks = new Map<string, AsyncLock>();
    private readonly documentSlugScopeLocks = new Map<string, AsyncLock>();
    private readonly cacheLock = new AsyncLock();
    private readonly createLock = new AsyncLock();

    constructor(db: DaycareDb) {
        this.db = db;
    }

    async findById(ctx: Context, id: string): Promise<DocumentDbRecord | null> {
        const userId = ctx.userId.trim();
        if (!userId) {
            return null;
        }
        const key = documentKey(userId, id);
        const cached = this.documentsById.get(key);
        if (cached) {
            return documentClone(cached);
        }

        const lock = this.documentLockForId(key);
        return lock.inLock(async () => {
            const existing = this.documentsById.get(key);
            if (existing) {
                return documentClone(existing);
            }
            const loaded = await this.documentLoadById(userId, id);
            if (!loaded) {
                return null;
            }
            await this.cacheLock.inLock(() => {
                this.documentCacheSet(loaded);
            });
            return documentClone(loaded);
        });
    }

    async findAnyById(ctx: Context, id: string): Promise<DocumentDbRecord | null> {
        const userId = ctx.userId.trim();
        if (!userId) {
            return null;
        }
        const key = documentKey(userId, id);
        const cached = this.documentsById.get(key);
        if (cached) {
            return documentClone(cached);
        }

        const lock = this.documentLockForId(key);
        return lock.inLock(async () => {
            const existing = this.documentsById.get(key);
            if (existing) {
                return documentClone(existing);
            }
            const loaded = await this.documentLoadAnyById(userId, id);
            if (!loaded) {
                return null;
            }
            if (loaded.validTo == null) {
                await this.cacheLock.inLock(() => {
                    this.documentCacheSet(loaded);
                });
            }
            return documentClone(loaded);
        });
    }

    async findBySlugAndParent(ctx: Context, slug: string, parentId: string | null): Promise<DocumentDbRecord | null> {
        const userId = ctx.userId.trim();
        if (!userId) {
            return null;
        }
        const normalizedSlug = slug.trim();
        if (!normalizedSlug) {
            return null;
        }
        return this.documentLoadBySlugAndParent(userId, normalizedSlug, documentIdNormalizeOptional(parentId));
    }

    async findChildren(ctx: Context, parentId: string | null): Promise<DocumentDbRecord[]> {
        const userId = ctx.userId.trim();
        if (!userId) {
            return [];
        }
        const normalizedParentId = documentIdNormalizeOptional(parentId);
        if (!normalizedParentId) {
            return this.findRoots(ctx);
        }

        const rows = await this.db
            .select({ document: documentsTable })
            .from(documentsTable)
            .innerJoin(
                documentReferencesTable,
                and(
                    eq(documentReferencesTable.userId, documentsTable.userId),
                    eq(documentReferencesTable.sourceId, documentsTable.id),
                    eq(documentReferencesTable.sourceVersion, documentsTable.version),
                    eq(documentReferencesTable.kind, "parent"),
                    eq(documentReferencesTable.targetId, normalizedParentId)
                )
            )
            .where(and(eq(documentsTable.userId, userId), isNull(documentsTable.validTo)))
            .orderBy(asc(documentsTable.slug), asc(documentsTable.id));

        const parsed = rows.map((row) => documentParse(row.document));
        await this.cacheLock.inLock(() => {
            for (const record of parsed) {
                this.documentCacheSet(record);
            }
        });
        return parsed.map((record) => documentClone(record));
    }

    async findRoots(ctx: Context): Promise<DocumentDbRecord[]> {
        const userId = ctx.userId.trim();
        if (!userId) {
            return [];
        }

        const rows = await this.db
            .select({ document: documentsTable })
            .from(documentsTable)
            .leftJoin(
                documentReferencesTable,
                and(
                    eq(documentReferencesTable.userId, documentsTable.userId),
                    eq(documentReferencesTable.sourceId, documentsTable.id),
                    eq(documentReferencesTable.sourceVersion, documentsTable.version),
                    eq(documentReferencesTable.kind, "parent")
                )
            )
            .where(
                and(
                    eq(documentsTable.userId, userId),
                    isNull(documentsTable.validTo),
                    isNull(documentReferencesTable.id)
                )
            )
            .orderBy(asc(documentsTable.slug), asc(documentsTable.id));

        const parsed = rows.map((row) => documentParse(row.document));
        await this.cacheLock.inLock(() => {
            for (const record of parsed) {
                this.documentCacheSet(record);
            }
        });
        return parsed.map((record) => documentClone(record));
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
        return this.documentParentIdLoad(userId, current.id, current.version ?? 1);
    }

    async findReferences(ctx: Context, id: string): Promise<DocumentReferenceDbRecord[]> {
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
            .from(documentReferencesTable)
            .where(
                and(
                    eq(documentReferencesTable.userId, userId),
                    eq(documentReferencesTable.sourceId, current.id),
                    eq(documentReferencesTable.sourceVersion, current.version ?? 1)
                )
            )
            .orderBy(asc(documentReferencesTable.kind), asc(documentReferencesTable.targetId));

        return rows.map((row) => documentReferenceParse(row));
    }

    async create(ctx: Context, input: DocumentCreateInput): Promise<DocumentDbRecord> {
        return this.createLock.inLock(async () => {
            const userId = ctx.userId.trim();
            if (!userId) {
                throw new Error("Document userId is required.");
            }

            const normalized = documentCreateNormalize(input);
            const key = documentKey(userId, normalized.id);
            const existing = this.documentsById.get(key) ?? (await this.documentLoadAnyById(userId, normalized.id));
            if (existing) {
                throw new Error(`Document id already exists: ${normalized.id}`);
            }

            const refs = await this.documentReferencesResolve(ctx, {
                userId,
                documentId: normalized.id,
                parentId: normalized.parentId,
                body: normalized.body,
                linkTargetIds: normalized.linkTargetIds ?? []
            });

            const slugScopeLock = this.documentSlugScopeLockFor(userId, refs.parentId, normalized.slug);
            return slugScopeLock.inLock(async () => {
                const clash = await this.documentLoadBySlugAndParent(userId, normalized.slug, refs.parentId);
                if (clash) {
                    throw new Error(`Document slug is already used under the same parent: ${normalized.slug}`);
                }

                const next: DocumentDbRecord = {
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
                    await tx.insert(documentsTable).values(documentRowInsert(next));
                    const refRows = documentReferenceRowsBuild(userId, next.id, next.version ?? 1, refs);
                    if (refRows.length > 0) {
                        await tx.insert(documentReferencesTable).values(refRows);
                    }
                });

                await this.cacheLock.inLock(() => {
                    this.documentCacheSet(next);
                });

                return documentClone(next);
            });
        });
    }

    async update(ctx: Context, id: string, input: DocumentUpdateInput): Promise<DocumentDbRecord> {
        const userId = ctx.userId.trim();
        if (!userId) {
            throw new Error("Document userId is required.");
        }
        const key = documentKey(userId, id);
        const lock = this.documentLockForId(key);

        return lock.inLock(async () => {
            const current = this.documentsById.get(key) ?? (await this.documentLoadById(userId, id));
            if (!current) {
                throw new Error(`Document not found: ${id}`);
            }

            const currentRefs = await this.documentReferenceSnapshotLoad(userId, current.id, current.version ?? 1);
            const nextParentId =
                input.parentId === undefined ? currentRefs.parentId : documentIdNormalizeOptional(input.parentId);
            const nextLinks =
                input.linkTargetIds === undefined
                    ? currentRefs.linkTargetIds
                    : documentIdsNormalize(input.linkTargetIds);

            const merged: DocumentDbRecord = {
                ...current,
                slug: input.slug?.trim() || current.slug,
                title: input.title?.trim() || current.title,
                description: input.description === undefined ? current.description : input.description.trim(),
                body: input.body === undefined ? current.body : input.body,
                createdAt: input.createdAt ?? current.createdAt,
                updatedAt: input.updatedAt ?? Date.now()
            };

            const refs = await this.documentReferencesResolve(ctx, {
                userId,
                documentId: current.id,
                parentId: nextParentId,
                body: merged.body,
                linkTargetIds: nextLinks
            });

            const slugScopeLock = this.documentSlugScopeLockFor(userId, refs.parentId, merged.slug);
            return slugScopeLock.inLock(async () => {
                const clash = await this.documentLoadBySlugAndParent(userId, merged.slug, refs.parentId);
                if (clash && clash.id !== current.id) {
                    throw new Error(`Document slug is already used under the same parent: ${merged.slug}`);
                }

                const advanced = await this.db.transaction(async (tx) => {
                    const next = await versionAdvance<DocumentDbRecord>({
                        changes: {
                            userId,
                            slug: merged.slug,
                            title: merged.title,
                            description: merged.description,
                            body: merged.body,
                            createdAt: merged.createdAt,
                            updatedAt: merged.updatedAt
                        },
                        findCurrent: async () => current,
                        closeCurrent: async (row, now) => {
                            const closedRows = await tx
                                .update(documentsTable)
                                .set({ validTo: now })
                                .where(
                                    and(
                                        eq(documentsTable.userId, row.userId),
                                        eq(documentsTable.id, row.id),
                                        eq(documentsTable.version, row.version ?? 1),
                                        isNull(documentsTable.validTo)
                                    )
                                )
                                .returning({ version: documentsTable.version });
                            return closedRows.length;
                        },
                        insertNext: async (row) => {
                            await tx.insert(documentsTable).values(documentRowInsert(row));
                        }
                    });

                    const refRows = documentReferenceRowsBuild(userId, next.id, next.version ?? 1, refs);
                    if (refRows.length > 0) {
                        await tx.insert(documentReferencesTable).values(refRows);
                    }
                    return next;
                });

                await this.cacheLock.inLock(() => {
                    this.documentCacheSet(advanced);
                });

                return documentClone(advanced);
            });
        });
    }

    async delete(ctx: Context, id: string): Promise<boolean> {
        const userId = ctx.userId.trim();
        if (!userId) {
            return false;
        }
        const key = documentKey(userId, id);
        const lock = this.documentLockForId(key);

        return lock.inLock(async () => {
            const current = this.documentsById.get(key) ?? (await this.documentLoadById(userId, id));
            if (!current) {
                return false;
            }

            const blockers = await this.db
                .select({ sourceId: documentReferencesTable.sourceId })
                .from(documentReferencesTable)
                .innerJoin(
                    documentsTable,
                    and(
                        eq(documentReferencesTable.userId, documentsTable.userId),
                        eq(documentReferencesTable.sourceId, documentsTable.id),
                        eq(documentReferencesTable.sourceVersion, documentsTable.version)
                    )
                )
                .where(
                    and(
                        eq(documentReferencesTable.userId, userId),
                        eq(documentReferencesTable.targetId, current.id),
                        inArray(documentReferencesTable.kind, ["parent", "link"]),
                        isNull(documentsTable.validTo)
                    )
                )
                .limit(1);
            if (blockers.length > 0) {
                throw new Error(`Document has active references and cannot be deleted: ${id}`);
            }

            const now = Date.now();
            await this.db
                .update(documentsTable)
                .set({ validTo: now })
                .where(
                    and(
                        eq(documentsTable.userId, current.userId),
                        eq(documentsTable.id, current.id),
                        eq(documentsTable.version, current.version ?? 1),
                        isNull(documentsTable.validTo)
                    )
                );

            await this.cacheLock.inLock(() => {
                this.documentsById.delete(key);
            });

            return true;
        });
    }

    private async documentReferencesResolve(
        ctx: Context,
        input: {
            userId: string;
            documentId: string;
            parentId: string | null;
            body: string;
            linkTargetIds: string[];
        }
    ): Promise<DocumentReferenceSnapshot> {
        if (input.parentId === input.documentId) {
            throw new Error(`Document cannot be its own parent: ${input.documentId}`);
        }

        if (input.parentId) {
            await this.documentTargetEnsureExists(input.userId, input.parentId);
            await this.documentParentCycleEnsure(input.userId, input.documentId, input.parentId);
        }

        for (const targetId of input.linkTargetIds) {
            await this.documentTargetEnsureExists(input.userId, targetId);
        }

        const bodyTargetIds = await documentBodyRefs(input.body, ctx, this);

        return {
            parentId: input.parentId,
            linkTargetIds: input.linkTargetIds,
            bodyTargetIds
        };
    }

    private async documentTargetEnsureExists(userId: string, id: string): Promise<void> {
        const target = await this.documentLoadById(userId, id);
        if (!target) {
            throw new Error(`Document target not found: ${id}`);
        }
    }

    private async documentReferenceSnapshotLoad(
        userId: string,
        sourceId: string,
        sourceVersion: number
    ): Promise<DocumentReferenceSnapshot> {
        const rows = await this.db
            .select()
            .from(documentReferencesTable)
            .where(
                and(
                    eq(documentReferencesTable.userId, userId),
                    eq(documentReferencesTable.sourceId, sourceId),
                    eq(documentReferencesTable.sourceVersion, sourceVersion),
                    inArray(documentReferencesTable.kind, ["parent", "link"])
                )
            )
            .orderBy(asc(documentReferencesTable.kind), asc(documentReferencesTable.targetId));

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

    private async documentLoadById(userId: string, id: string): Promise<DocumentDbRecord | null> {
        const rows = await this.db
            .select()
            .from(documentsTable)
            .where(and(eq(documentsTable.userId, userId), eq(documentsTable.id, id), isNull(documentsTable.validTo)))
            .limit(1);
        const row = rows[0];
        if (!row) {
            return null;
        }
        return documentParse(row);
    }

    private async documentLoadAnyById(userId: string, id: string): Promise<DocumentDbRecord | null> {
        const rows = await this.db
            .select()
            .from(documentsTable)
            .where(and(eq(documentsTable.userId, userId), eq(documentsTable.id, id)))
            .orderBy(desc(documentsTable.version))
            .limit(1);
        const row = rows[0];
        if (!row) {
            return null;
        }
        return documentParse(row);
    }

    private async documentLoadBySlugAndParent(
        userId: string,
        slug: string,
        parentId: string | null
    ): Promise<DocumentDbRecord | null> {
        if (parentId) {
            const rows = await this.db
                .select({ document: documentsTable })
                .from(documentsTable)
                .innerJoin(
                    documentReferencesTable,
                    and(
                        eq(documentReferencesTable.userId, documentsTable.userId),
                        eq(documentReferencesTable.sourceId, documentsTable.id),
                        eq(documentReferencesTable.sourceVersion, documentsTable.version),
                        eq(documentReferencesTable.kind, "parent"),
                        eq(documentReferencesTable.targetId, parentId)
                    )
                )
                .where(
                    and(
                        eq(documentsTable.userId, userId),
                        eq(documentsTable.slug, slug),
                        isNull(documentsTable.validTo)
                    )
                )
                .orderBy(asc(documentsTable.updatedAt), asc(documentsTable.id))
                .limit(1);
            const row = rows[0];
            if (!row) {
                return null;
            }
            const parsed = documentParse(row.document);
            await this.cacheLock.inLock(() => {
                this.documentCacheSet(parsed);
            });
            return documentClone(parsed);
        }

        const rows = await this.db
            .select({ document: documentsTable })
            .from(documentsTable)
            .leftJoin(
                documentReferencesTable,
                and(
                    eq(documentReferencesTable.userId, documentsTable.userId),
                    eq(documentReferencesTable.sourceId, documentsTable.id),
                    eq(documentReferencesTable.sourceVersion, documentsTable.version),
                    eq(documentReferencesTable.kind, "parent")
                )
            )
            .where(
                and(
                    eq(documentsTable.userId, userId),
                    eq(documentsTable.slug, slug),
                    isNull(documentsTable.validTo),
                    isNull(documentReferencesTable.id)
                )
            )
            .orderBy(asc(documentsTable.updatedAt), asc(documentsTable.id))
            .limit(1);
        const row = rows[0];
        if (!row) {
            return null;
        }
        const parsed = documentParse(row.document);
        await this.cacheLock.inLock(() => {
            this.documentCacheSet(parsed);
        });
        return documentClone(parsed);
    }

    private async documentParentIdLoad(
        userId: string,
        sourceId: string,
        sourceVersion: number
    ): Promise<string | null> {
        const rows = await this.db
            .select({ targetId: documentReferencesTable.targetId })
            .from(documentReferencesTable)
            .where(
                and(
                    eq(documentReferencesTable.userId, userId),
                    eq(documentReferencesTable.sourceId, sourceId),
                    eq(documentReferencesTable.sourceVersion, sourceVersion),
                    eq(documentReferencesTable.kind, "parent")
                )
            )
            .limit(1);
        const row = rows[0];
        if (!row) {
            return null;
        }
        return row.targetId;
    }

    private async documentParentCycleEnsure(userId: string, documentId: string, parentId: string): Promise<void> {
        const visited = new Set<string>();
        let currentId: string | null = parentId;
        while (currentId) {
            if (currentId === documentId || visited.has(currentId)) {
                throw new Error(`Document parent cycle detected for ${documentId}.`);
            }
            visited.add(currentId);
            const parent = await this.documentLoadById(userId, currentId);
            if (!parent) {
                throw new Error(`Document target not found: ${currentId}`);
            }
            currentId = await this.documentParentIdLoad(userId, parent.id, parent.version ?? 1);
        }
    }

    private documentCacheSet(record: DocumentDbRecord): void {
        this.documentsById.set(documentKey(record.userId, record.id), documentClone(record));
    }

    private documentLockForId(key: string): AsyncLock {
        const existing = this.documentLocks.get(key);
        if (existing) {
            return existing;
        }
        const lock = new AsyncLock();
        this.documentLocks.set(key, lock);
        return lock;
    }

    private documentSlugScopeLockFor(userId: string, parentId: string | null, slug: string): AsyncLock {
        const key = documentSlugScopeKey(userId, parentId, slug);
        const existing = this.documentSlugScopeLocks.get(key);
        if (existing) {
            return existing;
        }
        const lock = new AsyncLock();
        this.documentSlugScopeLocks.set(key, lock);
        return lock;
    }
}

function documentCreateNormalize(input: DocumentCreateInput): DocumentCreateInput & { parentId: string | null } {
    const normalizedId = input.id.trim();
    if (!normalizedId) {
        throw new Error("Document id is required.");
    }

    const normalizedSlug = input.slug.trim();
    if (!normalizedSlug) {
        throw new Error("Document slug is required.");
    }

    const normalizedTitle = input.title.trim();
    if (!normalizedTitle) {
        throw new Error("Document title is required.");
    }

    const normalizedDescription = input.description.trim();

    return {
        ...input,
        id: normalizedId,
        slug: normalizedSlug,
        title: normalizedTitle,
        description: normalizedDescription,
        body: input.body,
        parentId: documentIdNormalizeOptional(input.parentId),
        linkTargetIds: documentIdsNormalize(input.linkTargetIds)
    };
}

function documentParse(row: typeof documentsTable.$inferSelect): DocumentDbRecord {
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

function documentReferenceParse(row: typeof documentReferencesTable.$inferSelect): DocumentReferenceDbRecord {
    return {
        id: row.id,
        userId: row.userId,
        sourceId: row.sourceId,
        sourceVersion: row.sourceVersion,
        targetId: row.targetId,
        kind: row.kind as DocumentReferenceKind
    };
}

function documentClone(record: DocumentDbRecord): DocumentDbRecord {
    return { ...record };
}

function documentReferenceRowsBuild(
    userId: string,
    sourceId: string,
    sourceVersion: number,
    refs: DocumentReferenceSnapshot
): Array<typeof documentReferencesTable.$inferInsert> {
    const rows: Array<typeof documentReferencesTable.$inferInsert> = [];
    const seen = new Set<string>();

    const push = (kind: DocumentReferenceKind, targetId: string | null): void => {
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

function documentRowInsert(record: DocumentDbRecord): typeof documentsTable.$inferInsert {
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

function documentKey(userId: string, id: string): string {
    return `${userId}\u0000${id}`;
}

function documentSlugScopeKey(userId: string, parentId: string | null, slug: string): string {
    return `${userId}\u0000${parentId ?? "__root__"}\u0000${slug}`;
}

function documentIdNormalizeOptional(id: string | null | undefined): string | null {
    if (id === undefined || id === null) {
        return null;
    }
    const normalized = id.trim();
    return normalized.length > 0 ? normalized : null;
}

function documentIdsNormalize(ids: string[] | undefined): string[] {
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

type DocumentReferenceSnapshot = {
    parentId: string | null;
    linkTargetIds: string[];
    bodyTargetIds: string[];
};
