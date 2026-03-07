import { and, asc, eq, isNotNull, isNull } from "drizzle-orm";
import type { DaycareDb } from "../schema.js";
import { workspaceMembersTable } from "../schema.js";
import type { WorkspaceMemberDbRecord } from "./databaseTypes.js";

/**
 * Stores active and removed workspace membership rows.
 * Expects: schema migrations already applied for workspace_members.
 */
export class WorkspaceMembersRepository {
    private readonly db: DaycareDb;

    constructor(db: DaycareDb) {
        this.db = db;
    }

    async add(workspaceId: string, userId: string): Promise<void> {
        const normalized = workspaceMemberIdsNormalize(workspaceId, userId);
        const existing = await this.recordFind(normalized.workspaceId, normalized.userId);
        if (existing && existing.leftAt !== null) {
            throw new Error("You have been removed from this workspace.");
        }
        if (existing) {
            return;
        }

        await this.db
            .insert(workspaceMembersTable)
            .values({
                workspaceId: normalized.workspaceId,
                userId: normalized.userId,
                joinedAt: Date.now(),
                leftAt: null,
                kickReason: null
            })
            .onConflictDoNothing({
                target: [workspaceMembersTable.workspaceId, workspaceMembersTable.userId]
            });

        const current = await this.recordFind(normalized.workspaceId, normalized.userId);
        if (current && current.leftAt !== null) {
            throw new Error("You have been removed from this workspace.");
        }
    }

    async kick(workspaceId: string, userId: string, reason: string | null): Promise<void> {
        const normalized = workspaceMemberIdsNormalize(workspaceId, userId);
        await this.db
            .update(workspaceMembersTable)
            .set({
                leftAt: Date.now(),
                kickReason: textNullableNormalize(reason)
            })
            .where(
                and(
                    eq(workspaceMembersTable.workspaceId, normalized.workspaceId),
                    eq(workspaceMembersTable.userId, normalized.userId),
                    isNull(workspaceMembersTable.leftAt)
                )
            );
    }

    async findByWorkspace(workspaceId: string): Promise<WorkspaceMemberDbRecord[]> {
        const normalizedWorkspaceId = workspaceId.trim();
        if (!normalizedWorkspaceId) {
            return [];
        }

        const rows = await this.db
            .select()
            .from(workspaceMembersTable)
            .where(
                and(eq(workspaceMembersTable.workspaceId, normalizedWorkspaceId), isNull(workspaceMembersTable.leftAt))
            )
            .orderBy(asc(workspaceMembersTable.joinedAt), asc(workspaceMembersTable.id));

        return rows.map(workspaceMemberParse);
    }

    async findByUser(userId: string): Promise<WorkspaceMemberDbRecord[]> {
        const normalizedUserId = userId.trim();
        if (!normalizedUserId) {
            return [];
        }

        const rows = await this.db
            .select()
            .from(workspaceMembersTable)
            .where(and(eq(workspaceMembersTable.userId, normalizedUserId), isNull(workspaceMembersTable.leftAt)))
            .orderBy(asc(workspaceMembersTable.joinedAt), asc(workspaceMembersTable.id));

        return rows.map(workspaceMemberParse);
    }

    async isMember(workspaceId: string, userId: string): Promise<boolean> {
        const normalized = workspaceMemberIdsNormalize(workspaceId, userId);
        const rows = await this.db
            .select({ id: workspaceMembersTable.id })
            .from(workspaceMembersTable)
            .where(
                and(
                    eq(workspaceMembersTable.workspaceId, normalized.workspaceId),
                    eq(workspaceMembersTable.userId, normalized.userId),
                    isNull(workspaceMembersTable.leftAt)
                )
            )
            .limit(1);
        return rows.length > 0;
    }

    async isKicked(workspaceId: string, userId: string): Promise<boolean> {
        const normalized = workspaceMemberIdsNormalize(workspaceId, userId);
        const rows = await this.db
            .select({ id: workspaceMembersTable.id })
            .from(workspaceMembersTable)
            .where(
                and(
                    eq(workspaceMembersTable.workspaceId, normalized.workspaceId),
                    eq(workspaceMembersTable.userId, normalized.userId),
                    isNotNull(workspaceMembersTable.leftAt)
                )
            )
            .limit(1);
        return rows.length > 0;
    }

    private async recordFind(workspaceId: string, userId: string): Promise<WorkspaceMemberDbRecord | null> {
        const rows = await this.db
            .select()
            .from(workspaceMembersTable)
            .where(and(eq(workspaceMembersTable.workspaceId, workspaceId), eq(workspaceMembersTable.userId, userId)))
            .limit(1);
        return rows[0] ? workspaceMemberParse(rows[0]) : null;
    }
}

function workspaceMemberIdsNormalize(
    workspaceId: string,
    userId: string
): {
    workspaceId: string;
    userId: string;
} {
    const normalizedWorkspaceId = workspaceId.trim();
    const normalizedUserId = userId.trim();
    if (!normalizedWorkspaceId) {
        throw new Error("workspaceId is required.");
    }
    if (!normalizedUserId) {
        throw new Error("userId is required.");
    }
    return {
        workspaceId: normalizedWorkspaceId,
        userId: normalizedUserId
    };
}

function textNullableNormalize(value: string | null): string | null {
    const normalized = value?.trim() ?? "";
    return normalized || null;
}

function workspaceMemberParse(row: typeof workspaceMembersTable.$inferSelect): WorkspaceMemberDbRecord {
    return {
        id: row.id,
        workspaceId: row.workspaceId,
        userId: row.userId,
        joinedAt: row.joinedAt,
        leftAt: row.leftAt ?? null,
        kickReason: row.kickReason ?? null
    };
}
