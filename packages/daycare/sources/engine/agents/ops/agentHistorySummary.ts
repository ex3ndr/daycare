import type { AgentHistoryRecord } from "@/types";
import { messageContentExtractText } from "../../messages/messageContentExtractText.js";

type AgentHistoryRecordType = AgentHistoryRecord["type"];
type AgentHistorySummaryCounts = Record<AgentHistoryRecordType, number>;

type AgentHistorySummary = {
    recordCount: number;
    firstAt: number | null;
    lastAt: number | null;
    counts: AgentHistorySummaryCounts;
    lastUserMessage: string | null;
    lastAssistantMessage: string | null;
    lastNote: string | null;
    lastToolName: string | null;
};

/**
 * Builds compact summary metadata from agent history records.
 * Expects: records are in chronological order from oldest to newest.
 */
export function agentHistorySummary(records: AgentHistoryRecord[]): AgentHistorySummary {
    const counts = buildEmptyCounts();
    let firstAt: number | null = null;
    let lastAt: number | null = null;
    let lastUserMessage: string | null = null;
    let lastAssistantMessage: string | null = null;
    let lastNote: string | null = null;
    let lastToolName: string | null = null;

    for (const record of records) {
        counts[record.type] += 1;
        firstAt = firstAt === null ? record.at : Math.min(firstAt, record.at);
        lastAt = lastAt === null ? record.at : Math.max(lastAt, record.at);

        if (record.type === "user_message") {
            lastUserMessage = record.text;
            continue;
        }
        if (record.type === "assistant_message") {
            lastAssistantMessage = messageContentExtractText(record.content);
            continue;
        }
        if (record.type === "assistant_rewrite") {
            lastAssistantMessage = record.text;
            continue;
        }
        if (record.type === "note") {
            lastNote = record.text;
            continue;
        }
        if (record.type === "rlm_tool_result") {
            lastToolName = record.toolName;
        }
    }

    return {
        recordCount: records.length,
        firstAt,
        lastAt,
        counts,
        lastUserMessage,
        lastAssistantMessage,
        lastNote,
        lastToolName
    };
}

function buildEmptyCounts(): AgentHistorySummaryCounts {
    return {
        user_message: 0,
        assistant_message: 0,
        rlm_start: 0,
        rlm_tool_call: 0,
        rlm_tool_result: 0,
        rlm_complete: 0,
        assistant_rewrite: 0,
        note: 0
    };
}
