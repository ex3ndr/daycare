import type { AgentHistoryRecord, AgentHistoryRlmStartRecord, AgentHistoryRlmToolCallRecord } from "@/types";
import { rlmNoToolsExtract } from "../../modules/rlm/rlmNoToolsExtract.js";

type AssistantRunPythonContext = {
    assistantAt: number;
    historyResponseText: string;
    blocks: string[];
};

export type AgentLoopPendingPhase =
    | {
          type: "vm_start";
          blocks: string[];
          blockIndex: number;
          assistantAt: number;
          historyResponseText: string;
      }
    | {
          type: "tool_call";
          start: AgentHistoryRlmStartRecord;
          snapshot: AgentHistoryRlmToolCallRecord;
          blocks: string[];
          blockIndex: number;
          assistantAt: number;
          historyResponseText: string;
      }
    | {
          type: "error";
          start: AgentHistoryRlmStartRecord;
          message: string;
      };

/**
 * Resolves the pending flat-loop phase from persisted agent history.
 * Expects: records are ordered oldest-to-newest for a single agent.
 */
export function agentLoopPendingPhaseResolve(records: AgentHistoryRecord[]): AgentLoopPendingPhase | null {
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

    const pendingStart = [...startsByToolCallId.values()]
        .filter((start) => !completedToolCallIds.has(start.toolCallId))
        .sort((a, b) => b.at - a.at)[0];
    if (pendingStart) {
        const snapshots = records
            .filter(
                (record): record is AgentHistoryRlmToolCallRecord =>
                    record.type === "rlm_tool_call" && record.toolCallId === pendingStart.toolCallId
            )
            .sort((a, b) => b.at - a.at);

        const assistantContext = assistantRunPythonForStart(records, pendingStart.at, pendingStart.code);
        const blocks = assistantContext?.blocks ?? [pendingStart.code];
        const matchedIndex = blocks.indexOf(pendingStart.code);
        const blockIndex = matchedIndex >= 0 ? matchedIndex : 0;

        if (!snapshots[0]) {
            return {
                type: "error",
                start: pendingStart,
                message: "Process was restarted before any tool call"
            };
        }
        return {
            type: "tool_call",
            start: pendingStart,
            snapshot: snapshots[0],
            blocks,
            blockIndex,
            assistantAt: assistantContext?.assistantAt ?? pendingStart.at,
            historyResponseText: assistantContext?.historyResponseText ?? ""
        };
    }

    const latestAssistant = latestAssistantRunPythonResolve(records);
    if (!latestAssistant) {
        return null;
    }
    const hasRlmStartAfterAssistant = records.some(
        (record) => record.type === "rlm_start" && record.at > latestAssistant.assistantAt
    );
    if (hasRlmStartAfterAssistant) {
        return null;
    }
    return {
        type: "vm_start",
        blocks: latestAssistant.blocks,
        blockIndex: 0,
        assistantAt: latestAssistant.assistantAt,
        historyResponseText: latestAssistant.historyResponseText
    };
}

function latestAssistantRunPythonResolve(records: AgentHistoryRecord[]): AssistantRunPythonContext | null {
    const assistantTextByAt = new Map<number, string>();
    const assistantAts: number[] = [];
    for (const record of records) {
        if (record.type === "assistant_message") {
            assistantTextByAt.set(record.at, record.text);
            assistantAts.push(record.at);
            continue;
        }
        if (record.type === "assistant_rewrite" && assistantTextByAt.has(record.assistantAt)) {
            assistantTextByAt.set(record.assistantAt, record.text);
        }
    }
    for (let index = assistantAts.length - 1; index >= 0; index -= 1) {
        const assistantAt = assistantAts[index]!;
        const text = assistantTextByAt.get(assistantAt) ?? "";
        const blocks = rlmNoToolsExtract(text);
        if (blocks.length === 0) {
            continue;
        }
        return {
            assistantAt,
            historyResponseText: text,
            blocks
        };
    }
    return null;
}

function assistantRunPythonForStart(
    records: AgentHistoryRecord[],
    startAt: number,
    startCode: string
): AssistantRunPythonContext | null {
    const candidates: AssistantRunPythonContext[] = [];
    const assistantTextByAt = new Map<number, string>();
    for (const record of records) {
        if (record.type === "assistant_message" && record.at <= startAt) {
            assistantTextByAt.set(record.at, record.text);
            continue;
        }
        if (
            record.type === "assistant_rewrite" &&
            record.assistantAt <= startAt &&
            assistantTextByAt.has(record.assistantAt)
        ) {
            assistantTextByAt.set(record.assistantAt, record.text);
        }
    }
    for (const [assistantAt, historyResponseText] of assistantTextByAt.entries()) {
        const blocks = rlmNoToolsExtract(historyResponseText);
        if (blocks.length === 0) {
            continue;
        }
        candidates.push({ assistantAt, historyResponseText, blocks });
    }
    candidates.sort((a, b) => b.assistantAt - a.assistantAt);
    for (const candidate of candidates) {
        if (candidate.blocks.some((code) => code === startCode)) {
            return candidate;
        }
    }
    return candidates[0] ?? null;
}
