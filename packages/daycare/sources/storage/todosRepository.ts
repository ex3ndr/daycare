import { createId } from "@paralleldrive/cuid2";
import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import type { Context, TodoDbRecord, TodoStatus } from "@/types";
import type { DaycareDb } from "../schema.js";
import { todosTable } from "../schema.js";
import { TODO_STATUSES } from "../todos/todoTypes.js";
import { generateKeyBetween } from "../utils/fractionalIndex.js";
import { AsyncLock } from "../utils/lock.js";
import { versionAdvance } from "./versionAdvance.js";

export type TodoCreateInput = {
    id?: string;
    parentId?: string | null;
    title: string;
    description?: string | null;
    status?: TodoStatus;
    createdAt?: number;
    updatedAt?: number;
};

export type TodoUpdateInput = {
    title?: string;
    description?: string | null;
    status?: TodoStatus;
    updatedAt?: number;
};

type TodoCreateNormalized = {
    id?: string;
    parentId: string | null;
    title: string;
    description: string;
    status: TodoStatus;
    createdAt?: number;
    updatedAt?: number;
};

type TodoUpdateNormalized = {
    title?: string;
    description?: string;
    status?: TodoStatus;
    updatedAt?: number;
};

/**
 * Stores versioned workspace-scoped todos with hierarchical ordering.
 * Expects: ctx.userId resolves the active workspace user id.
 */
export class TodosRepository {
    private readonly db: DaycareDb;
    private readonly todosById = new Map<string, TodoDbRecord>();
    private readonly writeLock = new AsyncLock();

    constructor(db: DaycareDb) {
        this.db = db;
    }

    async create(ctx: Context, input: TodoCreateInput): Promise<TodoDbRecord> {
        const workspaceId = workspaceIdResolve(ctx);
        const normalized = todoCreateNormalize(input);
        const now = normalized.updatedAt ?? normalized.createdAt ?? Date.now();
        const createdAt = normalized.createdAt ?? now;
        const updatedAt = normalized.updatedAt ?? now;

        return this.writeLock.inLock(async () => {
            const id = normalized.id || createId();
            const reserved = await this.todoLoadAnyById(workspaceId, id);
            if (reserved) {
                throw new Error(`Todo id already exists: ${id}`);
            }

            if (normalized.parentId) {
                const parent = await this.todoLoadById(workspaceId, normalized.parentId);
                if (!parent) {
                    throw new Error(`Parent todo not found: ${normalized.parentId}`);
                }
            }

            const siblings = normalized.parentId
                ? await this.todoLoadByParent(workspaceId, normalized.parentId)
                : await this.todoLoadRoots(workspaceId);
            const rank = generateKeyBetween(siblings.at(-1)?.rank ?? null, null);
            const next: TodoDbRecord = {
                id,
                workspaceId,
                parentId: normalized.parentId,
                title: normalized.title,
                description: normalized.description,
                status: normalized.status,
                rank,
                version: 1,
                validFrom: createdAt,
                validTo: null,
                createdAt,
                updatedAt
            };

            await this.db.insert(todosTable).values(todoRowInsert(next));
            this.todoCacheSet(next);
            return todoClone(next);
        });
    }

    async findById(ctx: Context, id: string): Promise<TodoDbRecord | null> {
        const workspaceId = workspaceIdResolve(ctx);
        const normalizedId = idNormalize(id, "todo id");
        const cached = this.todosById.get(todoKey(workspaceId, normalizedId));
        if (cached) {
            return todoClone(cached);
        }

        const loaded = await this.todoLoadById(workspaceId, normalizedId);
        if (!loaded) {
            return null;
        }
        this.todoCacheSet(loaded);
        return todoClone(loaded);
    }

    async findByParent(ctx: Context, parentId: string | null): Promise<TodoDbRecord[]> {
        const workspaceId = workspaceIdResolve(ctx);
        const normalizedParentId = parentIdNormalize(parentId);
        const rows = normalizedParentId
            ? await this.todoLoadByParent(workspaceId, normalizedParentId)
            : await this.todoLoadRoots(workspaceId);
        return rows.map(todoClone);
    }

    async findRoots(ctx: Context): Promise<TodoDbRecord[]> {
        const workspaceId = workspaceIdResolve(ctx);
        return (await this.todoLoadRoots(workspaceId)).map(todoClone);
    }

    async findTree(ctx: Context, rootId?: string, depth?: number): Promise<TodoDbRecord[]> {
        const workspaceId = workspaceIdResolve(ctx);
        const normalizedRootId = rootId?.trim() ? idNormalize(rootId, "rootId") : null;
        const normalizedDepth = depthResolve(depth, normalizedRootId);

        const roots = normalizedRootId
            ? await this.todoLoadRoot(workspaceId, normalizedRootId)
            : await this.todoLoadRoots(workspaceId);
        if (roots.length === 0) {
            return [];
        }

        const byParent = new Map<string, TodoDbRecord[]>();
        let frontier = roots.map((todo) => todo.id);
        let remainingDepth = normalizedDepth;
        while (frontier.length > 0 && remainingDepth !== 0) {
            const children = await this.todoLoadByParentIds(workspaceId, frontier);
            if (children.length === 0) {
                break;
            }

            for (const child of children) {
                const siblings = byParent.get(child.parentId ?? "") ?? [];
                siblings.push(child);
                byParent.set(child.parentId ?? "", siblings);
            }

            frontier = children.map((todo) => todo.id);
            if (remainingDepth !== Number.POSITIVE_INFINITY) {
                remainingDepth -= 1;
            }
        }

        const ordered: TodoDbRecord[] = [];
        for (const root of roots) {
            ordered.push(root);
            treeWalk(root.id, byParent, ordered);
        }
        return ordered.map(todoClone);
    }

    async update(ctx: Context, id: string, input: TodoUpdateInput): Promise<TodoDbRecord> {
        const workspaceId = workspaceIdResolve(ctx);
        const normalizedId = idNormalize(id, "todo id");
        const normalized = todoUpdateNormalize(input);
        const now = normalized.updatedAt ?? Date.now();

        return this.writeLock.inLock(async () => {
            const current = await this.todoLoadById(workspaceId, normalizedId);
            if (!current) {
                throw new Error(`Todo not found: ${normalizedId}`);
            }

            if (normalized.status === "abandoned") {
                const updated = await this.todoStatusCascadeUpdate(
                    workspaceId,
                    [normalizedId],
                    "abandoned",
                    {
                        [normalizedId]: {
                            title: normalized.title,
                            description: normalized.description
                        }
                    },
                    now
                );
                const target = updated[0];
                if (!target) {
                    throw new Error(`Todo not found: ${normalizedId}`);
                }
                return todoClone(target);
            }

            const next = await this.db.transaction((tx) =>
                todoVersionAdvance(tx, current, {
                    title: normalized.title ?? current.title,
                    description: normalized.description ?? current.description,
                    status: normalized.status ?? current.status,
                    updatedAt: now
                })
            );
            this.todoCacheSet(next);
            return todoClone(next);
        });
    }

    async reorder(ctx: Context, id: string, parentId: string | null, index: number): Promise<TodoDbRecord> {
        const workspaceId = workspaceIdResolve(ctx);
        const normalizedId = idNormalize(id, "todo id");
        const normalizedParentId = parentIdNormalize(parentId);
        const normalizedIndex = indexNormalize(index);

        return this.writeLock.inLock(async () => {
            const current = await this.todoLoadById(workspaceId, normalizedId);
            if (!current) {
                throw new Error(`Todo not found: ${normalizedId}`);
            }
            if (normalizedParentId === normalizedId) {
                throw new Error("A todo cannot be its own parent.");
            }
            if (normalizedParentId) {
                const parent = await this.todoLoadById(workspaceId, normalizedParentId);
                if (!parent) {
                    throw new Error(`Parent todo not found: ${normalizedParentId}`);
                }
                const descendants = await this.todoDescendantsLoad(workspaceId, [normalizedId]);
                if (descendants.some((entry) => entry.id === normalizedParentId)) {
                    throw new Error("A todo cannot be moved under its own descendant.");
                }
            }

            const siblings = normalizedParentId
                ? await this.todoLoadByParent(workspaceId, normalizedParentId)
                : await this.todoLoadRoots(workspaceId);
            const filtered = siblings.filter((entry) => entry.id !== normalizedId);
            if (normalizedIndex > filtered.length) {
                throw new Error(`index is out of range: ${normalizedIndex}`);
            }

            const previous = filtered[normalizedIndex - 1] ?? null;
            const nextSibling = filtered[normalizedIndex] ?? null;
            const rank = generateKeyBetween(previous?.rank ?? null, nextSibling?.rank ?? null);
            const now = Date.now();
            const next = await this.db.transaction((tx) =>
                todoVersionAdvance(tx, current, {
                    parentId: normalizedParentId,
                    rank,
                    updatedAt: now
                })
            );
            this.todoCacheSet(next);
            return todoClone(next);
        });
    }

    async archive(ctx: Context, id: string): Promise<TodoDbRecord> {
        const workspaceId = workspaceIdResolve(ctx);
        const normalizedId = idNormalize(id, "todo id");
        return this.writeLock.inLock(async () => {
            const archived = await this.todoStatusCascadeUpdate(workspaceId, [normalizedId], "abandoned");
            const target = archived[0];
            if (!target) {
                throw new Error(`Todo not found: ${normalizedId}`);
            }
            return todoClone(target);
        });
    }

    async batchUpdateStatus(ctx: Context, ids: string[], status: TodoStatus): Promise<TodoDbRecord[]> {
        const workspaceId = workspaceIdResolve(ctx);
        const normalizedIds = idsNormalize(ids);
        const normalizedStatus = statusNormalize(status);
        return this.writeLock.inLock(async () => {
            const updated = await this.todoStatusCascadeUpdate(workspaceId, normalizedIds, normalizedStatus);
            return updated.map(todoClone);
        });
    }

    private async todoLoadRoot(workspaceId: string, rootId: string): Promise<TodoDbRecord[]> {
        const root = await this.todoLoadById(workspaceId, rootId);
        return root ? [root] : [];
    }

    private async todoLoadById(workspaceId: string, id: string): Promise<TodoDbRecord | null> {
        const rows = await this.db
            .select()
            .from(todosTable)
            .where(and(eq(todosTable.workspaceId, workspaceId), eq(todosTable.id, id), isNull(todosTable.validTo)))
            .limit(1);
        return rows[0] ? todoParse(rows[0]) : null;
    }

    private async todoLoadAnyById(workspaceId: string, id: string): Promise<TodoDbRecord | null> {
        const rows = await this.db
            .select()
            .from(todosTable)
            .where(and(eq(todosTable.workspaceId, workspaceId), eq(todosTable.id, id)))
            .orderBy(asc(todosTable.version))
            .limit(1);
        return rows[0] ? todoParse(rows[0]) : null;
    }

    private async todoLoadRoots(workspaceId: string): Promise<TodoDbRecord[]> {
        const rows = await this.db
            .select()
            .from(todosTable)
            .where(
                and(eq(todosTable.workspaceId, workspaceId), isNull(todosTable.parentId), isNull(todosTable.validTo))
            )
            .orderBy(asc(todosTable.rank), asc(todosTable.id));
        return rows.map(todoParse);
    }

    private async todoLoadByParent(workspaceId: string, parentId: string): Promise<TodoDbRecord[]> {
        const rows = await this.db
            .select()
            .from(todosTable)
            .where(
                and(
                    eq(todosTable.workspaceId, workspaceId),
                    eq(todosTable.parentId, parentId),
                    isNull(todosTable.validTo)
                )
            )
            .orderBy(asc(todosTable.rank), asc(todosTable.id));
        return rows.map(todoParse);
    }

    private async todoLoadByParentIds(workspaceId: string, parentIds: string[]): Promise<TodoDbRecord[]> {
        if (parentIds.length === 0) {
            return [];
        }
        const rows = await this.db
            .select()
            .from(todosTable)
            .where(
                and(
                    eq(todosTable.workspaceId, workspaceId),
                    inArray(todosTable.parentId, parentIds),
                    isNull(todosTable.validTo)
                )
            )
            .orderBy(asc(todosTable.parentId), asc(todosTable.rank), asc(todosTable.id));
        return rows.map(todoParse);
    }

    private async todoLoadByIds(workspaceId: string, ids: string[]): Promise<TodoDbRecord[]> {
        if (ids.length === 0) {
            return [];
        }
        const rows = await this.db
            .select()
            .from(todosTable)
            .where(
                and(eq(todosTable.workspaceId, workspaceId), inArray(todosTable.id, ids), isNull(todosTable.validTo))
            );
        return rows.map(todoParse);
    }

    private async todoDescendantsLoad(workspaceId: string, rootIds: string[]): Promise<TodoDbRecord[]> {
        const descendants: TodoDbRecord[] = [];
        let frontier = [...rootIds];
        while (frontier.length > 0) {
            const children = await this.todoLoadByParentIds(workspaceId, frontier);
            if (children.length === 0) {
                break;
            }
            descendants.push(...children);
            frontier = children.map((todo) => todo.id);
        }
        return descendants;
    }

    private async todoStatusCascadeUpdate(
        workspaceId: string,
        ids: string[],
        status: TodoStatus,
        extraById: Record<string, { title?: string; description?: string }> = {},
        now: number = Date.now()
    ): Promise<TodoDbRecord[]> {
        const current = await this.todoLoadByIds(workspaceId, ids);
        if (current.length !== ids.length) {
            const foundIds = new Set(current.map((entry) => entry.id));
            const missingId = ids.find((id) => !foundIds.has(id));
            throw new Error(`Todo not found: ${missingId ?? ids[0]}`);
        }

        const descendantIds =
            status === "abandoned" ? (await this.todoDescendantsLoad(workspaceId, ids)).map((entry) => entry.id) : [];
        const targetIds = Array.from(new Set([...ids, ...descendantIds]));
        const targetRows = await this.todoLoadByIds(workspaceId, targetIds);
        const byId = new Map(targetRows.map((entry) => [entry.id, entry]));

        const updated = await this.db.transaction(async (tx) => {
            const results: TodoDbRecord[] = [];
            for (const targetId of targetIds) {
                const row = byId.get(targetId);
                if (!row) {
                    throw new Error(`Todo not found: ${targetId}`);
                }
                const extra = extraById[targetId];
                const next = await todoVersionAdvance(tx, row, {
                    title: extra?.title ?? row.title,
                    description: extra?.description ?? row.description,
                    status,
                    updatedAt: now
                });
                results.push(next);
            }
            return results;
        });

        for (const todo of updated) {
            this.todoCacheSet(todo);
        }

        const resultById = new Map(updated.map((entry) => [entry.id, entry]));
        return ids.map((id) => {
            const todo = resultById.get(id);
            if (!todo) {
                throw new Error(`Todo not found: ${id}`);
            }
            return todo;
        });
    }

    private todoCacheSet(todo: TodoDbRecord): void {
        this.todosById.set(todoKey(todo.workspaceId, todo.id), todoClone(todo));
    }
}

function treeWalk(parentId: string, byParent: Map<string, TodoDbRecord[]>, ordered: TodoDbRecord[]): void {
    for (const child of byParent.get(parentId) ?? []) {
        ordered.push(child);
        treeWalk(child.id, byParent, ordered);
    }
}

async function todoVersionAdvance(
    tx: DaycareDb,
    current: TodoDbRecord,
    changes: {
        parentId?: string | null;
        title?: string;
        description?: string;
        status?: TodoStatus;
        rank?: string;
        updatedAt: number;
    }
): Promise<TodoDbRecord> {
    return versionAdvance<TodoDbRecord>({
        now: changes.updatedAt,
        changes: {
            workspaceId: current.workspaceId,
            parentId: changes.parentId ?? current.parentId,
            title: changes.title ?? current.title,
            description: changes.description ?? current.description,
            status: changes.status ?? current.status,
            rank: changes.rank ?? current.rank,
            createdAt: current.createdAt,
            updatedAt: changes.updatedAt
        },
        findCurrent: async () => current,
        closeCurrent: async (row, now) => {
            const closedRows = await tx
                .update(todosTable)
                .set({ validTo: now })
                .where(
                    and(
                        eq(todosTable.workspaceId, row.workspaceId),
                        eq(todosTable.id, row.id),
                        eq(todosTable.version, row.version ?? 1),
                        isNull(todosTable.validTo)
                    )
                )
                .returning({ version: todosTable.version });
            return closedRows.length;
        },
        insertNext: async (row) => {
            await tx.insert(todosTable).values(todoRowInsert(row));
        }
    });
}

function workspaceIdResolve(ctx: Context): string {
    return idNormalize(ctx.userId, "workspaceId");
}

function depthResolve(depth: number | undefined, rootId: string | null): number {
    if (depth === undefined) {
        return rootId ? Number.POSITIVE_INFINITY : 2;
    }
    const normalized = Math.trunc(depth);
    if (!Number.isFinite(normalized) || normalized < 0) {
        throw new Error("depth must be a non-negative integer.");
    }
    return normalized;
}

function indexNormalize(index: number): number {
    const normalized = Math.trunc(index);
    if (!Number.isFinite(normalized) || normalized < 0) {
        throw new Error("index must be a non-negative integer.");
    }
    return normalized;
}

function idsNormalize(ids: string[]): string[] {
    const normalized = Array.from(new Set(ids.map((id) => idNormalize(id, "todo id"))));
    if (normalized.length === 0) {
        throw new Error("ids are required.");
    }
    return normalized;
}

function todoCreateNormalize(input: TodoCreateInput): TodoCreateNormalized {
    return {
        id: input.id?.trim() || undefined,
        parentId: parentIdNormalize(input.parentId),
        title: titleNormalize(input.title),
        description: descriptionNormalize(input.description),
        status: statusNormalize(input.status ?? "unstarted"),
        createdAt: timestampNormalize(input.createdAt),
        updatedAt: timestampNormalize(input.updatedAt)
    };
}

function todoUpdateNormalize(input: TodoUpdateInput): TodoUpdateNormalized {
    return {
        title: input.title === undefined ? undefined : titleNormalize(input.title),
        description: input.description === undefined ? undefined : descriptionNormalize(input.description),
        status: input.status === undefined ? undefined : statusNormalize(input.status),
        updatedAt: timestampNormalize(input.updatedAt)
    };
}

function idNormalize(value: string, field: string): string {
    const normalized = value.trim();
    if (!normalized) {
        throw new Error(`${field} is required.`);
    }
    return normalized;
}

function parentIdNormalize(value: string | null | undefined): string | null {
    const normalized = value?.trim() ?? "";
    return normalized || null;
}

function titleNormalize(value: string): string {
    const normalized = value.trim();
    if (!normalized) {
        throw new Error("title is required.");
    }
    return normalized;
}

function descriptionNormalize(value: string | null | undefined): string {
    return value?.trim() ?? "";
}

function statusNormalize(value: string): TodoStatus {
    const normalized = value.trim();
    if (!TODO_STATUSES.includes(normalized as TodoStatus)) {
        throw new Error(`Invalid todo status: ${value}`);
    }
    return normalized as TodoStatus;
}

function timestampNormalize(value: number | undefined): number | undefined {
    if (value === undefined) {
        return undefined;
    }
    const normalized = Math.trunc(value);
    if (!Number.isFinite(normalized) || normalized < 0) {
        throw new Error("timestamp must be a non-negative integer.");
    }
    return normalized;
}

function todoRowInsert(record: TodoDbRecord): typeof todosTable.$inferInsert {
    return {
        id: record.id,
        workspaceId: record.workspaceId,
        parentId: record.parentId,
        title: record.title,
        description: record.description,
        status: record.status,
        rank: record.rank,
        version: record.version ?? 1,
        validFrom: record.validFrom ?? record.createdAt,
        validTo: record.validTo ?? null,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt
    };
}

function todoParse(row: typeof todosTable.$inferSelect): TodoDbRecord {
    return {
        id: row.id,
        workspaceId: row.workspaceId,
        parentId: row.parentId ?? null,
        title: row.title,
        description: row.description,
        status: statusNormalize(row.status),
        rank: row.rank,
        version: row.version,
        validFrom: row.validFrom,
        validTo: row.validTo ?? null,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt
    };
}

function todoClone(todo: TodoDbRecord): TodoDbRecord {
    return {
        ...todo
    };
}

function todoKey(workspaceId: string, id: string): string {
    return `${workspaceId}::${id}`;
}
