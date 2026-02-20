import type { ChannelMessage, ChannelSignalData } from "@/types";

/**
 * Formats a channel signal payload into a readable system message for agents.
 * Expects: data fields have already been validated.
 */
export function channelMessageBuild(data: ChannelSignalData): string {
    const mentionText = data.mentions.length > 0 ? data.mentions.map((mention) => `@${mention}`).join(", ") : "none";
    const lines = [`[Channel: #${data.channelName}] @${data.senderUsername}: ${data.text}`, `mentions: ${mentionText}`];
    const recentHistory = historyContextBuild(data.history, data.messageId);
    if (recentHistory.length > 0) {
        lines.push("recent:");
        lines.push(...recentHistory.map((line) => `- ${line}`));
    }
    return lines.join("\n");
}

/**
 * Safely parses channel signal data from a generic signal payload.
 * Returns: null when payload shape does not match ChannelSignalData.
 */
export function channelSignalDataParse(data: unknown): ChannelSignalData | null {
    if (!isRecord(data)) {
        return null;
    }
    if (
        typeof data.channelName !== "string" ||
        typeof data.messageId !== "string" ||
        typeof data.senderUsername !== "string" ||
        typeof data.text !== "string" ||
        typeof data.createdAt !== "number" ||
        !Array.isArray(data.mentions) ||
        !Array.isArray(data.history)
    ) {
        return null;
    }

    const mentions: string[] = [];
    for (const mention of data.mentions) {
        if (typeof mention !== "string") {
            return null;
        }
        mentions.push(mention);
    }
    const history: ChannelMessage[] = [];
    for (const entry of data.history) {
        if (!isRecord(entry)) {
            return null;
        }
        if (
            typeof entry.id !== "string" ||
            typeof entry.channelName !== "string" ||
            typeof entry.senderUsername !== "string" ||
            typeof entry.text !== "string" ||
            typeof entry.createdAt !== "number" ||
            !Array.isArray(entry.mentions)
        ) {
            return null;
        }
        const entryMentions: string[] = [];
        for (const mention of entry.mentions) {
            if (typeof mention !== "string") {
                return null;
            }
            entryMentions.push(mention);
        }
        history.push({
            id: entry.id,
            channelName: entry.channelName,
            senderUsername: entry.senderUsername,
            text: entry.text,
            mentions: entryMentions,
            createdAt: entry.createdAt
        });
    }

    return {
        channelName: data.channelName,
        messageId: data.messageId,
        senderUsername: data.senderUsername,
        text: data.text,
        mentions,
        createdAt: data.createdAt,
        history
    };
}

function historyContextBuild(history: ChannelMessage[], currentMessageId: string): string[] {
    return history
        .filter((entry) => entry.id !== currentMessageId)
        .slice(-5)
        .map((entry) => `@${entry.senderUsername}: ${entry.text}`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
}
