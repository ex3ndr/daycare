import type { StorageDatabase as DatabaseSync } from "./databaseOpen.js";
import type { Context } from "@/types";
import type { ChannelMessageDbRecord, DatabaseChannelMessageRow } from "./databaseTypes.js";

/**
 * Channel messages repository backed by SQLite.
 * Expects: schema migrations already applied for channel_messages.
 */
export class ChannelMessagesRepository {
    private readonly db: DatabaseSync;

    constructor(db: DatabaseSync) {
        this.db = db;
    }

    async create(record: ChannelMessageDbRecord): Promise<void> {
        this.db
            .prepare(
                `
                  INSERT INTO channel_messages (
                    id,
                    channel_id,
                    user_id,
                    sender_username,
                    text,
                    mentions,
                    created_at
                  ) VALUES (?, ?, ?, ?, ?, ?, ?)
                  ON CONFLICT(id) DO UPDATE SET
                    channel_id = excluded.channel_id,
                    user_id = excluded.user_id,
                    sender_username = excluded.sender_username,
                    text = excluded.text,
                    mentions = excluded.mentions,
                    created_at = excluded.created_at
                `
            )
            .run(
                record.id,
                record.channelId,
                record.userId,
                record.senderUsername,
                record.text,
                JSON.stringify(record.mentions),
                record.createdAt
            );
    }

    async findRecent(ctx: Context, channelId: string, limit = 50): Promise<ChannelMessageDbRecord[]> {
        const normalizedLimit = Math.min(500, Math.max(1, Math.floor(limit)));
        const rows = this.db
            .prepare(
                `
                  SELECT *
                  FROM channel_messages
                  WHERE user_id = ? AND channel_id = ?
                  ORDER BY created_at DESC, id DESC
                  LIMIT ?
                `
            )
            .all(ctx.userId, channelId, normalizedLimit) as DatabaseChannelMessageRow[];
        return rows
            .map((row) => this.messageParse(row))
            .reverse()
            .map((record) => messageClone(record));
    }

    private messageParse(row: DatabaseChannelMessageRow): ChannelMessageDbRecord {
        return {
            id: row.id,
            channelId: row.channel_id,
            userId: row.user_id,
            senderUsername: row.sender_username,
            text: row.text,
            mentions: mentionsParse(row.mentions),
            createdAt: row.created_at
        };
    }
}

function mentionsParse(raw: string): string[] {
    try {
        const parsed = JSON.parse(raw) as unknown;
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
