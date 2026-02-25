import type { AgentHistoryRecord, FileReference } from "@/types";

const SYMBOLS_PER_TOKEN = 4;
const IMAGE_SYMBOLS_ESTIMATE = 512;

/**
 * Estimates token usage from history records using a symbols/4 heuristic.
 * Expects: records are ordered and contain valid user/assistant entries.
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
        return record.text.length + estimateFileSymbols(record.files);
    }
    return 0;
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
