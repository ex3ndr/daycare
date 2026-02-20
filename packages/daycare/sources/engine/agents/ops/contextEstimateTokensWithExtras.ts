import type { Tool } from "@mariozechner/pi-ai";

import type { AgentHistoryRecord } from "@/types";

import { contextEstimateTokens } from "./contextEstimateTokens.js";

const SYMBOLS_PER_TOKEN = 4;
const IMAGE_DATA_PLACEHOLDER = "<image>";

export type ContextEstimateTokensExtras = {
    systemPrompt?: string;
    tools?: Tool[];
    extraText?: string[];
    extraValues?: unknown[];
    extraTokens?: number;
};

/**
 * Estimates total tokens using history records plus heuristic extras.
 * Expects: history records are ordered; extras include raw strings or values.
 */
export function contextEstimateTokensWithExtras(
    history: AgentHistoryRecord[],
    extras: ContextEstimateTokensExtras = {}
): number {
    const baseTokens = contextEstimateTokens(history);
    const extraTokens = normalizeExtraTokens(extras.extraTokens);
    const extraSymbols = estimateExtrasSymbols(extras);
    return baseTokens + extraTokens + symbolsToTokens(extraSymbols);
}

function estimateExtrasSymbols(extras: ContextEstimateTokensExtras): number {
    let symbols = 0;
    if (extras.systemPrompt) {
        symbols += extras.systemPrompt.length;
    }
    if (extras.tools && extras.tools.length > 0) {
        symbols += safeStringLength(extras.tools);
    }
    if (extras.extraText) {
        for (const text of extras.extraText) {
            symbols += text.length;
        }
    }
    if (extras.extraValues) {
        for (const value of extras.extraValues) {
            symbols += safeStringLength(value);
        }
    }
    return symbols;
}

function normalizeExtraTokens(value: number | undefined): number {
    if (typeof value !== "number" || !Number.isFinite(value)) {
        return 0;
    }
    return Math.max(0, Math.floor(value));
}

function symbolsToTokens(symbols: number): number {
    if (symbols <= 0) {
        return 0;
    }
    return Math.ceil(symbols / SYMBOLS_PER_TOKEN);
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
