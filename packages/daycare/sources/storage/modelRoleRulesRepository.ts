import { createId } from "@paralleldrive/cuid2";
import { eq } from "drizzle-orm";

import type { DaycareDb } from "../schema.js";
import { modelRoleRulesTable } from "../schema.js";

export type ModelRoleRuleDbRecord = {
    id: string;
    role: string | null;
    kind: string | null;
    userId: string | null;
    agentId: string | null;
    model: string;
    createdAt: number;
    updatedAt: number;
};

export type ModelRoleRuleCreateInput = {
    id?: string;
    role?: string | null;
    kind?: string | null;
    userId?: string | null;
    agentId?: string | null;
    model: string;
};

export type ModelRoleRuleUpdateInput = {
    role?: string | null;
    kind?: string | null;
    userId?: string | null;
    agentId?: string | null;
    model?: string;
};

/**
 * Repository for model role override rules.
 * Simple CRUD — no temporal versioning.
 *
 * Expects: schema migrations already applied for model_role_rules.
 */
export class ModelRoleRulesRepository {
    private readonly db: DaycareDb;

    constructor(db: DaycareDb) {
        this.db = db;
    }

    async findAll(): Promise<ModelRoleRuleDbRecord[]> {
        const rows = await this.db.select().from(modelRoleRulesTable);
        return rows.map(ruleParse);
    }

    async findById(id: string): Promise<ModelRoleRuleDbRecord | null> {
        const rows = await this.db.select().from(modelRoleRulesTable).where(eq(modelRoleRulesTable.id, id)).limit(1);
        const row = rows[0];
        return row ? ruleParse(row) : null;
    }

    async insert(input: ModelRoleRuleCreateInput): Promise<ModelRoleRuleDbRecord> {
        const now = Date.now();
        const record: ModelRoleRuleDbRecord = {
            id: input.id ?? createId(),
            role: input.role ?? null,
            kind: input.kind ?? null,
            userId: input.userId ?? null,
            agentId: input.agentId ?? null,
            model: input.model,
            createdAt: now,
            updatedAt: now
        };

        await this.db.insert(modelRoleRulesTable).values({
            id: record.id,
            role: record.role,
            kind: record.kind,
            userId: record.userId,
            agentId: record.agentId,
            model: record.model,
            createdAt: record.createdAt,
            updatedAt: record.updatedAt
        });

        return record;
    }

    async update(id: string, input: ModelRoleRuleUpdateInput): Promise<ModelRoleRuleDbRecord | null> {
        const existing = await this.findById(id);
        if (!existing) {
            return null;
        }

        const now = Date.now();
        const updated: ModelRoleRuleDbRecord = {
            ...existing,
            role: input.role !== undefined ? input.role : existing.role,
            kind: input.kind !== undefined ? input.kind : existing.kind,
            userId: input.userId !== undefined ? input.userId : existing.userId,
            agentId: input.agentId !== undefined ? input.agentId : existing.agentId,
            model: input.model ?? existing.model,
            updatedAt: now
        };

        await this.db
            .update(modelRoleRulesTable)
            .set({
                role: updated.role,
                kind: updated.kind,
                userId: updated.userId,
                agentId: updated.agentId,
                model: updated.model,
                updatedAt: updated.updatedAt
            })
            .where(eq(modelRoleRulesTable.id, id));

        return updated;
    }

    async delete(id: string): Promise<boolean> {
        const result = await this.db
            .delete(modelRoleRulesTable)
            .where(eq(modelRoleRulesTable.id, id))
            .returning({ id: modelRoleRulesTable.id });
        return result.length > 0;
    }
}

function ruleParse(row: typeof modelRoleRulesTable.$inferSelect): ModelRoleRuleDbRecord {
    return {
        id: row.id,
        role: row.role,
        kind: row.kind,
        userId: row.userId,
        agentId: row.agentId,
        model: row.model,
        createdAt: row.createdAt,
        updatedAt: row.updatedAt
    };
}
