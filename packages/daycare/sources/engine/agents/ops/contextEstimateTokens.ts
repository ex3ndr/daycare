import type { ToolCall, ToolResultMessage } from "@mariozechner/pi-ai";

import type { AgentHistoryRecord, FileReference } from "@/types";

const SYMBOLS_PER_TOKEN = 4;
const IMAGE_SYMBOLS_ESTIMATE = 512;
const IMAGE_DATA_PLACEHOLDER = "<image>";

/**
 * Estimates token usage from history records using a symbols/4 heuristic.
 * Expects: records are ordered and contain valid user/assistant/tool entries.
 */
export function contextEstimateTokens(records: AgentHistoryRecord[]): number {
    const symbols = records.reduce((total, record) => total + estimateRecordSymbols(record), 0);
    if (symbols <= 0) {
        return 0;
    }
    return Math.ceil(symbols / SYMBOLS_PER_TOKEN);
}

function estimateRecordSymbols(record: AgentHistoryRecord): number {
    if (record.type === "user_message") {
        return record.text.length + estimateFileSymbols(record.files);
    }
    if (record.type === "assistant_message") {
        return record.text.length + estimateFileSymbols(record.files) + estimateToolCallsSymbols(record.toolCalls);
    }
    if (record.type === "tool_result") {
        return estimateToolMessageSymbols(record.output.toolMessage);
    }
    return 0;
}

function estimateToolCallsSymbols(toolCalls: ToolCall[]): number {
    return toolCalls.reduce((total, toolCall) => total + safeStringLength(toolCall), 0);
}

function estimateToolMessageSymbols(message: ToolResultMessage): number {
    return estimateToolMessageContentSymbols(message.content);
}

function estimateToolMessageContentSymbols(content: unknown): number {
    if (typeof content === "string") {
        return content.length;
    }
    if (Array.isArray(content)) {
        return content.reduce((total, item) => total + estimateContentItemSymbols(item), 0);
    }
    return safeStringLength(content);
}

function estimateContentItemSymbols(item: unknown): number {
    if (item && typeof item === "object") {
        if (isImageLike(item)) {
            return IMAGE_SYMBOLS_ESTIMATE;
        }
        const maybeText = item as { type?: string; text?: unknown };
        if (maybeText.type === "text" && typeof maybeText.text === "string") {
            return maybeText.text.length;
        }
    }
    return safeStringLength(item);
}

function estimateFileSymbols(files: FileReference[]): number {
    return files.reduce((total, file) => total + estimateFileSymbol(file), 0);
}

function estimateFileSymbol(file: FileReference): number {
    if (file.mimeType.startsWith("image/")) {
        return IMAGE_SYMBOLS_ESTIMATE;
    }
    return 0;
}

function safeStringLength(value: unknown): number {
    if (typeof value === "string") {
        return value.length;
    }
    try {
        const encoded = JSON.stringify(sanitizeImageData(value, 0, new WeakSet()));
        return encoded ? encoded.length : 0;
    } catch {
        return 0;
    }
}

function sanitizeImageData(value: unknown, depth: number, seen: WeakSet<object>): unknown {
    if (!value || typeof value !== "object") {
        return value;
    }
    if (seen.has(value)) {
        return null;
    }
    if (depth > 6) {
        return null;
    }
    seen.add(value);
    if (Array.isArray(value)) {
        return value.map((entry) => sanitizeImageData(entry, depth + 1, seen));
    }
    if (isImageLike(value)) {
        const image = value as Record<string, unknown>;
        return { ...image, data: IMAGE_DATA_PLACEHOLDER };
    }
    const record = value as Record<string, unknown>;
    const sanitized: Record<string, unknown> = {};
    for (const [key, entry] of Object.entries(record)) {
        sanitized[key] = sanitizeImageData(entry, depth + 1, seen);
    }
    return sanitized;
}

function isImageLike(value: unknown): boolean {
    if (!value || typeof value !== "object") {
        return false;
    }
    const record = value as { type?: unknown; data?: unknown; mimeType?: unknown };
    if (record.type === "image" && typeof record.data === "string") {
        return true;
    }
    return (
        typeof record.mimeType === "string" && record.mimeType.startsWith("image/") && typeof record.data === "string"
    );
}
