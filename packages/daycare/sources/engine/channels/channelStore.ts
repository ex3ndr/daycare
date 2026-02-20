import { promises as fs } from "node:fs";
import path from "node:path";

import { z } from "zod";

import type { Channel, ChannelMessage } from "@/types";
import { atomicWrite } from "../../util/atomicWrite.js";

const CHANNEL_NAME_PATTERN = /^[a-z0-9][a-z0-9_-]{0,79}$/;

const channelMessageSchema = z
    .object({
        id: z.string().min(1),
        channelName: z.string().min(1),
        senderUsername: z.string().min(1),
        text: z.string(),
        mentions: z.array(z.string().min(1)),
        createdAt: z.number().int().nonnegative()
    })
    .strict();

const channelSchema = z
    .object({
        id: z.string().min(1),
        name: z.string().min(1),
        leader: z.string().min(1),
        members: z.array(
            z
                .object({
                    agentId: z.string().min(1),
                    username: z.string().min(1),
                    joinedAt: z.number().int().nonnegative()
                })
                .strict()
        ),
        createdAt: z.number().int().nonnegative(),
        updatedAt: z.number().int().nonnegative()
    })
    .strict();

/**
 * Normalizes and validates a channel name used for disk paths and signal keys.
 * Expects: input name contains only a-z, 0-9, dot, underscore, or dash.
 */
export function channelNameNormalize(name: string): string {
    const normalized = name.trim().toLowerCase();
    if (!CHANNEL_NAME_PATTERN.test(normalized)) {
        throw new Error(
            "Channel name must be Slack-style: lowercase letters, numbers, hyphen, underscore (max 80 chars)."
        );
    }
    return normalized;
}

/**
 * Loads a channel definition from `<baseDir>/<name>/channel.json`.
 * Returns: null when the channel file does not exist.
 */
export async function channelLoad(baseDir: string, name: string): Promise<Channel | null> {
    const channelName = channelNameNormalize(name);
    const filePath = channelFilePathBuild(baseDir, channelName);
    let raw = "";
    try {
        raw = await fs.readFile(filePath, "utf8");
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") {
            return null;
        }
        throw error;
    }
    const parsed = channelSchema.parse(JSON.parse(raw)) as Channel;
    if (parsed.name !== channelName) {
        throw new Error(`Channel file name mismatch: expected "${channelName}".`);
    }
    return parsed;
}

/**
 * Persists a channel definition to `<baseDir>/<name>/channel.json`.
 * Expects: channel.name is a valid normalized channel name.
 */
export async function channelSave(baseDir: string, channel: Channel): Promise<void> {
    const channelName = channelNameNormalize(channel.name);
    const payload = channelSchema.parse({ ...channel, name: channelName }) as Channel;
    const directory = channelDirectoryPathBuild(baseDir, channelName);
    await fs.mkdir(directory, { recursive: true });
    await atomicWrite(channelFilePathBuild(baseDir, channelName), `${JSON.stringify(payload, null, 2)}\n`);
}

/**
 * Appends a channel message to `<baseDir>/<name>/history.jsonl`.
 * Expects: message.channelName matches the target channel name.
 */
export async function channelAppendMessage(baseDir: string, name: string, message: ChannelMessage): Promise<void> {
    const channelName = channelNameNormalize(name);
    const payload = channelMessageSchema.parse({
        ...message,
        channelName
    }) as ChannelMessage;
    const directory = channelDirectoryPathBuild(baseDir, channelName);
    await fs.mkdir(directory, { recursive: true });
    await fs.appendFile(channelHistoryPathBuild(baseDir, channelName), `${JSON.stringify(payload)}\n`, "utf8");
}

/**
 * Reads recent channel history from `<baseDir>/<name>/history.jsonl`.
 * Returns: an empty array when no history file exists.
 */
export async function channelReadHistory(baseDir: string, name: string, limit = 50): Promise<ChannelMessage[]> {
    const channelName = channelNameNormalize(name);
    const normalizedLimit = channelLimitNormalize(limit);
    const filePath = channelHistoryPathBuild(baseDir, channelName);
    let raw = "";
    try {
        raw = await fs.readFile(filePath, "utf8");
    } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") {
            return [];
        }
        throw error;
    }

    const lines = raw.split("\n").filter((line) => line.trim().length > 0);
    if (lines.length === 0) {
        return [];
    }
    const start = Math.max(0, lines.length - normalizedLimit);
    const recent = lines.slice(start);
    const result: ChannelMessage[] = [];
    for (const line of recent) {
        let rawValue: unknown = null;
        try {
            rawValue = JSON.parse(line);
        } catch {
            continue;
        }
        const parsed = channelMessageSchema.safeParse(rawValue);
        if (!parsed.success) {
            continue;
        }
        result.push(parsed.data);
    }
    return result;
}

function channelDirectoryPathBuild(baseDir: string, name: string): string {
    return path.join(baseDir, name);
}

function channelFilePathBuild(baseDir: string, name: string): string {
    return path.join(channelDirectoryPathBuild(baseDir, name), "channel.json");
}

function channelHistoryPathBuild(baseDir: string, name: string): string {
    return path.join(channelDirectoryPathBuild(baseDir, name), "history.jsonl");
}

function channelLimitNormalize(limit: number): number {
    if (!Number.isFinite(limit)) {
        return 50;
    }
    return Math.min(500, Math.max(1, Math.floor(limit)));
}
