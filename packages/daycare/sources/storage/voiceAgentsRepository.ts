import { and, asc, eq } from "drizzle-orm";
import type { Context } from "@/types";
import type { DaycareDb } from "../schema.js";
import { voiceAgentsTable } from "../schema.js";
import { AsyncLock } from "../utils/lock.js";
import type { DatabaseVoiceAgentRow, VoiceAgentDbRecord } from "./databaseTypes.js";

export type VoiceAgentCreateInput = {
    id: string;
    name: string;
    description?: string | null;
    systemPrompt: string;
    tools?: VoiceAgentDbRecord["tools"];
    settings?: VoiceAgentDbRecord["settings"];
    createdAt: number;
    updatedAt: number;
};

export type VoiceAgentUpdateInput = {
    name?: string;
    description?: string | null;
    systemPrompt?: string;
    tools?: VoiceAgentDbRecord["tools"];
    settings?: VoiceAgentDbRecord["settings"];
    updatedAt?: number;
};

/**
 * Stores voice-agent definitions scoped to the current user/workspace context.
 * Expects: schema migrations already applied for voice_agents.
 */
export class VoiceAgentsRepository {
    private readonly db: DaycareDb;
    private readonly cache = new Map<string, VoiceAgentDbRecord>();
    private readonly locks = new Map<string, AsyncLock>();

    constructor(db: DaycareDb) {
        this.db = db;
    }

    async create(ctx: Context, input: VoiceAgentCreateInput): Promise<VoiceAgentDbRecord> {
        const userId = ctx.userId.trim();
        const id = input.id.trim();
        const name = input.name.trim();
        const systemPrompt = input.systemPrompt.trim();
        if (!userId) {
            throw new Error("Voice agent userId is required.");
        }
        if (!id) {
            throw new Error("Voice agent id is required.");
        }
        if (!name) {
            throw new Error("Voice agent name is required.");
        }
        if (!systemPrompt) {
            throw new Error("Voice agent systemPrompt is required.");
        }

        const key = voiceAgentKey(userId, id);
        return this.lockFor(key).inLock(async () => {
            const existing = this.cache.get(key) ?? (await this.findById(ctx, id));
            if (existing) {
                throw new Error(`Voice agent already exists: ${id}`);
            }

            const record: VoiceAgentDbRecord = {
                id,
                userId,
                name,
                description: input.description?.trim() || null,
                systemPrompt,
                tools: voiceAgentToolsNormalize(input.tools),
                settings: voiceAgentSettingsNormalize(input.settings),
                createdAt: input.createdAt,
                updatedAt: input.updatedAt
            };
            await this.db.insert(voiceAgentsTable).values(voiceAgentRowInsert(record));
            this.cache.set(key, voiceAgentClone(record));
            return voiceAgentClone(record);
        });
    }

    async update(ctx: Context, id: string, input: VoiceAgentUpdateInput): Promise<VoiceAgentDbRecord> {
        const userId = ctx.userId.trim();
        const normalizedId = id.trim();
        if (!userId) {
            throw new Error("Voice agent userId is required.");
        }
        if (!normalizedId) {
            throw new Error("Voice agent id is required.");
        }

        const key = voiceAgentKey(userId, normalizedId);
        return this.lockFor(key).inLock(async () => {
            const current = this.cache.get(key) ?? (await this.findById(ctx, normalizedId));
            if (!current) {
                throw new Error(`Voice agent not found: ${normalizedId}`);
            }

            const next: VoiceAgentDbRecord = {
                ...current,
                name: input.name?.trim() ? input.name.trim() : current.name,
                description: input.description === undefined ? current.description : input.description?.trim() || null,
                systemPrompt: input.systemPrompt?.trim() ? input.systemPrompt.trim() : current.systemPrompt,
                tools: input.tools !== undefined ? voiceAgentToolsNormalize(input.tools) : current.tools,
                settings: input.settings !== undefined ? voiceAgentSettingsNormalize(input.settings) : current.settings,
                updatedAt: input.updatedAt ?? Date.now()
            };
            await this.db
                .update(voiceAgentsTable)
                .set({
                    name: next.name,
                    description: next.description,
                    systemPrompt: next.systemPrompt,
                    tools: next.tools,
                    settings: next.settings,
                    updatedAt: next.updatedAt
                })
                .where(and(eq(voiceAgentsTable.userId, userId), eq(voiceAgentsTable.id, normalizedId)));
            this.cache.set(key, voiceAgentClone(next));
            return voiceAgentClone(next);
        });
    }

    async delete(ctx: Context, id: string): Promise<VoiceAgentDbRecord> {
        const userId = ctx.userId.trim();
        const normalizedId = id.trim();
        if (!userId) {
            throw new Error("Voice agent userId is required.");
        }
        if (!normalizedId) {
            throw new Error("Voice agent id is required.");
        }

        const key = voiceAgentKey(userId, normalizedId);
        return this.lockFor(key).inLock(async () => {
            const current = this.cache.get(key) ?? (await this.findById(ctx, normalizedId));
            if (!current) {
                throw new Error(`Voice agent not found: ${normalizedId}`);
            }

            await this.db
                .delete(voiceAgentsTable)
                .where(and(eq(voiceAgentsTable.userId, userId), eq(voiceAgentsTable.id, normalizedId)));
            this.cache.delete(key);
            return voiceAgentClone(current);
        });
    }

    async findById(ctx: Context, id: string): Promise<VoiceAgentDbRecord | null> {
        const userId = ctx.userId.trim();
        const normalizedId = id.trim();
        if (!userId || !normalizedId) {
            return null;
        }

        const key = voiceAgentKey(userId, normalizedId);
        const cached = this.cache.get(key);
        if (cached) {
            return voiceAgentClone(cached);
        }

        const rows = await this.db
            .select()
            .from(voiceAgentsTable)
            .where(and(eq(voiceAgentsTable.userId, userId), eq(voiceAgentsTable.id, normalizedId)))
            .limit(1);
        const row = rows[0];
        if (!row) {
            return null;
        }
        const parsed = voiceAgentParse(row);
        this.cache.set(key, voiceAgentClone(parsed));
        return voiceAgentClone(parsed);
    }

    async findMany(ctx: Context): Promise<VoiceAgentDbRecord[]> {
        const userId = ctx.userId.trim();
        if (!userId) {
            return [];
        }

        const rows = await this.db
            .select()
            .from(voiceAgentsTable)
            .where(eq(voiceAgentsTable.userId, userId))
            .orderBy(asc(voiceAgentsTable.updatedAt), asc(voiceAgentsTable.id));
        const parsed = rows.map((row) => voiceAgentParse(row));
        for (const record of parsed) {
            this.cache.set(voiceAgentKey(userId, record.id), voiceAgentClone(record));
        }
        return parsed.map((record) => voiceAgentClone(record));
    }

    private lockFor(key: string): AsyncLock {
        const existing = this.locks.get(key);
        if (existing) {
            return existing;
        }
        const created = new AsyncLock();
        this.locks.set(key, created);
        return created;
    }
}

function voiceAgentParse(row: typeof voiceAgentsTable.$inferSelect | DatabaseVoiceAgentRow): VoiceAgentDbRecord {
    const userId = "userId" in row ? row.userId : row.user_id;
    const systemPrompt = "systemPrompt" in row ? row.systemPrompt : row.system_prompt;
    const createdAt = "createdAt" in row ? row.createdAt : row.created_at;
    const updatedAt = "updatedAt" in row ? row.updatedAt : row.updated_at;
    return {
        id: row.id,
        userId,
        name: row.name,
        description: row.description,
        systemPrompt,
        tools: voiceAgentToolsNormalize(row.tools),
        settings: voiceAgentSettingsNormalize(row.settings),
        createdAt,
        updatedAt
    };
}

function voiceAgentRowInsert(record: VoiceAgentDbRecord): typeof voiceAgentsTable.$inferInsert {
    return {
        id: record.id,
        userId: record.userId,
        name: record.name,
        description: record.description,
        systemPrompt: record.systemPrompt,
        tools: record.tools,
        settings: record.settings,
        createdAt: record.createdAt,
        updatedAt: record.updatedAt
    };
}

function voiceAgentToolsNormalize(tools: unknown): VoiceAgentDbRecord["tools"] {
    if (!Array.isArray(tools)) {
        return [];
    }
    return tools
        .filter((entry): entry is Record<string, unknown> => typeof entry === "object" && entry !== null)
        .map((entry) => ({
            name: typeof entry.name === "string" ? entry.name.trim() : "",
            description: typeof entry.description === "string" ? entry.description.trim() : "",
            parameters:
                typeof entry.parameters === "object" && entry.parameters !== null
                    ? Object.fromEntries(
                          Object.entries(entry.parameters).map(([key, value]) => [
                              key,
                              voiceAgentToolParameterNormalize(value)
                          ])
                      )
                    : {}
        }))
        .filter((entry) => entry.name.length > 0 && entry.description.length > 0);
}

function voiceAgentToolParameterNormalize(value: unknown): {
    type: string;
    description: string;
    required?: boolean;
} {
    if (typeof value !== "object" || value === null) {
        return {
            type: "string",
            description: ""
        };
    }
    const parameter = value as Record<string, unknown>;
    return {
        type: typeof parameter.type === "string" && parameter.type.trim() ? parameter.type.trim() : "string",
        description: typeof parameter.description === "string" ? parameter.description.trim() : "",
        required: parameter.required === true ? true : undefined
    };
}

function voiceAgentSettingsNormalize(settings: unknown): VoiceAgentDbRecord["settings"] {
    if (!settings || typeof settings !== "object" || Array.isArray(settings)) {
        return {};
    }
    return { ...settings };
}

function voiceAgentKey(userId: string, id: string): string {
    return `${userId}\u0000${id}`;
}

function voiceAgentClone(record: VoiceAgentDbRecord): VoiceAgentDbRecord {
    return {
        ...record,
        tools: record.tools.map((tool) => ({
            ...tool,
            parameters: { ...tool.parameters }
        })),
        settings: { ...record.settings }
    };
}
