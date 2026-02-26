import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import type { StorageDatabase } from "../databaseOpen.js";
import { databasePathResolve } from "../databasePathResolve.js";
import type { Migration } from "./migrationTypes.js";

export const migration20260222ImportChannels: Migration = {
    name: "20260222_import_channels",
    up(db): void {
        const dbPath = databasePathResolve(db);
        if (!dbPath) {
            return;
        }

        const configDir = path.dirname(dbPath);
        const channelsDir = path.join(configDir, "channels");
        if (!existsSync(channelsDir)) {
            return;
        }

        const ownerUserId = ownerUserIdResolve(db);
        const entries = readdirSync(channelsDir, { withFileTypes: true });
        for (const entry of entries) {
            if (!entry.isDirectory()) {
                continue;
            }

            const channelBase = path.join(channelsDir, entry.name);
            const channelData = channelRead(path.join(channelBase, "channel.json"));
            if (!channelData) {
                continue;
            }

            const channelUserId = agentUserIdResolve(db, channelData.leader) ?? ownerUserId;
            db.prepare(
                `
                  INSERT OR IGNORE INTO channels (
                    id,
                    user_id,
                    name,
                    leader,
                    created_at,
                    updated_at
                  ) VALUES (?, ?, ?, ?, ?, ?)
                `
            ).run(
                channelData.id,
                channelUserId,
                channelData.name,
                channelData.leader,
                channelData.createdAt,
                channelData.updatedAt
            );

            for (const member of channelData.members) {
                const memberUserId = agentUserIdResolve(db, member.agentId) ?? channelUserId;
                db.prepare(
                    `
                      INSERT OR IGNORE INTO channel_members (
                        channel_id,
                        user_id,
                        agent_id,
                        username,
                        joined_at
                      ) VALUES (?, ?, ?, ?, ?)
                    `
                ).run(channelData.id, memberUserId, member.agentId, member.username, member.joinedAt);
            }

            const history = channelHistoryRead(path.join(channelBase, "history.jsonl"));
            for (const message of history) {
                db.prepare(
                    `
                      INSERT OR IGNORE INTO channel_messages (
                        id,
                        channel_id,
                        user_id,
                        sender_username,
                        text,
                        mentions,
                        created_at
                      ) VALUES (?, ?, ?, ?, ?, ?, ?)
                    `
                ).run(
                    message.id,
                    channelData.id,
                    channelUserId,
                    message.senderUsername,
                    message.text,
                    JSON.stringify(message.mentions),
                    message.createdAt
                );
            }
        }
    }
};

function ownerUserIdResolve(db: Pick<StorageDatabase, "prepare">): string {
    const row = db.prepare("SELECT id FROM users WHERE is_owner = 1 LIMIT 1").get() as { id?: unknown } | undefined;
    const ownerId = typeof row?.id === "string" ? row.id.trim() : "";
    return ownerId || "owner";
}

function agentUserIdResolve(db: Pick<StorageDatabase, "prepare">, agentId: string): string | null {
    const row = db.prepare("SELECT user_id FROM agents WHERE id = ? LIMIT 1").get(agentId) as
        | { user_id?: unknown }
        | undefined;
    if (typeof row?.user_id !== "string") {
        return null;
    }
    const userId = row.user_id.trim();
    return userId.length > 0 ? userId : null;
}

function channelRead(filePath: string): {
    id: string;
    name: string;
    leader: string;
    members: Array<{ agentId: string; username: string; joinedAt: number }>;
    createdAt: number;
    updatedAt: number;
} | null {
    if (!existsSync(filePath)) {
        return null;
    }

    try {
        const parsed = JSON.parse(readFileSync(filePath, "utf8")) as {
            id?: unknown;
            name?: unknown;
            leader?: unknown;
            members?: unknown;
            createdAt?: unknown;
            updatedAt?: unknown;
        };
        const id = stringOrNull(parsed.id);
        const name = stringOrNull(parsed.name);
        const leader = stringOrNull(parsed.leader);
        if (!id || !name || !leader) {
            return null;
        }

        const members = Array.isArray(parsed.members)
            ? parsed.members
                  .map((entry) => memberParse(entry))
                  .filter((entry): entry is { agentId: string; username: string; joinedAt: number } => !!entry)
            : [];

        return {
            id,
            name,
            leader,
            members,
            createdAt: numberOrNow(parsed.createdAt),
            updatedAt: numberOrNow(parsed.updatedAt)
        };
    } catch {
        return null;
    }
}

function memberParse(value: unknown): { agentId: string; username: string; joinedAt: number } | null {
    if (!value || typeof value !== "object") {
        return null;
    }
    const parsed = value as { agentId?: unknown; username?: unknown; joinedAt?: unknown };
    const agentId = stringOrNull(parsed.agentId);
    const username = stringOrNull(parsed.username);
    if (!agentId || !username) {
        return null;
    }
    return {
        agentId,
        username,
        joinedAt: numberOrNow(parsed.joinedAt)
    };
}

function channelHistoryRead(filePath: string): Array<{
    id: string;
    senderUsername: string;
    text: string;
    mentions: string[];
    createdAt: number;
}> {
    if (!existsSync(filePath)) {
        return [];
    }

    const lines = readFileSync(filePath, "utf8").split("\n");
    const messages: Array<{
        id: string;
        senderUsername: string;
        text: string;
        mentions: string[];
        createdAt: number;
    }> = [];

    for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) {
            continue;
        }
        try {
            const parsed = JSON.parse(trimmed) as {
                id?: unknown;
                senderUsername?: unknown;
                text?: unknown;
                mentions?: unknown;
                createdAt?: unknown;
            };
            const id = stringOrNull(parsed.id);
            const senderUsername = stringOrNull(parsed.senderUsername);
            const text = stringOrNull(parsed.text);
            if (!id || !senderUsername || !text) {
                continue;
            }

            const mentions = Array.isArray(parsed.mentions)
                ? parsed.mentions.filter((entry): entry is string => typeof entry === "string")
                : [];
            messages.push({
                id,
                senderUsername,
                text,
                mentions,
                createdAt: numberOrNow(parsed.createdAt)
            });
        } catch {}
    }

    return messages;
}

function stringOrNull(value: unknown): string | null {
    if (typeof value !== "string") {
        return null;
    }
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
}

function numberOrNow(value: unknown): number {
    if (typeof value === "number" && Number.isFinite(value) && value >= 0) {
        return Math.floor(value);
    }
    return Date.now();
}
