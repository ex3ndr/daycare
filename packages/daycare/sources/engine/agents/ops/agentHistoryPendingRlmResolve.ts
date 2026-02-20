import type { AgentHistoryRecord, AgentHistoryRlmStartRecord, AgentHistoryRlmToolCallRecord } from "@/types";

export type AgentHistoryPendingRlm = {
    start: AgentHistoryRlmStartRecord;
    lastSnapshot: AgentHistoryRlmToolCallRecord | null;
};

/**
 * Resolves the latest incomplete RLM execution from history records.
 * Expects: records are ordered chronologically from oldest to newest.
 */
export function agentHistoryPendingRlmResolve(records: AgentHistoryRecord[]): AgentHistoryPendingRlm | null {
    const startsByToolCallId = new Map<string, AgentHistoryRlmStartRecord>();
    const completedToolCallIds = new Set<string>();

    for (const record of records) {
        if (record.type === "rlm_start") {
            startsByToolCallId.set(record.toolCallId, record);
            continue;
        }
        if (record.type === "rlm_complete") {
            completedToolCallIds.add(record.toolCallId);
        }
    }

    const pendingStarts = [...startsByToolCallId.values()]
        .filter((start) => !completedToolCallIds.has(start.toolCallId))
        .sort((a, b) => b.at - a.at);
    const pendingStart = pendingStarts[0];
    if (!pendingStart) {
        return null;
    }

    const snapshots = records
        .filter(
            (record): record is AgentHistoryRlmToolCallRecord =>
                record.type === "rlm_tool_call" && record.toolCallId === pendingStart.toolCallId
        )
        .sort((a, b) => b.at - a.at);
    return {
        start: pendingStart,
        lastSnapshot: snapshots[0] ?? null
    };
}
