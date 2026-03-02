import { and, desc, eq } from "drizzle-orm";
import type { Context } from "@/types";
import type { DaycareDb } from "../schema.js";
import { channelMessagesTable } from "../schema.js";
import type { ChannelMessageDbRecord } from "./databaseTypes.js";

/**
 * Channel messages repository backed by Drizzle.
 * Expects: schema migrations already applied for channel_messages.
 */
export class ChannelMessagesRepository {
    private readonly db: DaycareDb;

    constructor(db: DaycareDb) {
        this.db = db;
    }

    async create(record: ChannelMessageDbRecord): Promise<void> {
        await this.db
            .insert(channelMessagesTable)
            .values({
                id: record.id,
                channelId: record.channelId,
                userId: record.userId,
                senderUsername: record.senderUsername,
                text: record.text,
                mentions: record.mentions,
                createdAt: record.createdAt
            })
            .onConflictDoUpdate({
                target: channelMessagesTable.id,
                set: {
                    channelId: record.channelId,
                    userId: record.userId,
                    senderUsername: record.senderUsername,
                    text: record.text,
                    mentions: record.mentions,
                    createdAt: record.createdAt
                }
            });
    }

    async findRecent(ctx: Context, channelId: string, limit = 50): Promise<ChannelMessageDbRecord[]> {
        const normalizedLimit = Math.min(500, Math.max(1, Math.floor(limit)));
        const rows = await this.db
            .select()
            .from(channelMessagesTable)
            .where(and(eq(channelMessagesTable.userId, ctx.userId), eq(channelMessagesTable.channelId, channelId)))
            .orderBy(desc(channelMessagesTable.createdAt), desc(channelMessagesTable.id))
            .limit(normalizedLimit);
        return rows
            .map((row) => messageParse(row))
            .reverse()
            .map((record) => messageClone(record));
    }
}

function messageParse(row: typeof channelMessagesTable.$inferSelect): ChannelMessageDbRecord {
    return {
        id: row.id,
        channelId: row.channelId,
        userId: row.userId,
        senderUsername: row.senderUsername,
        text: row.text,
        mentions: mentionsParse(row.mentions),
        createdAt: row.createdAt
    };
}

function mentionsParse(raw: unknown): string[] {
    try {
        const parsed = typeof raw === "string" ? (JSON.parse(raw) as unknown) : raw;
        if (!Array.isArray(parsed)) {
            return [];
        }
        return parsed.filter((entry): entry is string => typeof entry === "string");
    } catch {
        return [];
    }
}

function messageClone(record: ChannelMessageDbRecord): ChannelMessageDbRecord {
    return {
        ...record,
        mentions: [...record.mentions]
    };
}
