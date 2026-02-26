import type { AgentHistoryRecord, AgentHistoryRlmStartRecord, AgentHistoryRlmToolCallRecord } from "@/types";
import { RLM_TOOL_NAME } from "../../modules/rlm/rlmConstants.js";

type AssistantRunPythonContext = {
    assistantAt: number;
    historyResponseText: string;
    blocks: string[];
    blockToolCallIds: string[];
};

export type AgentLoopPendingPhase =
    | {
          type: "vm_start";
          blocks: string[];
          blockToolCallIds: string[];
          blockIndex: number;
          assistantAt: number;
          historyResponseText: string;
      }
    | {
          type: "tool_call";
          start: AgentHistoryRlmStartRecord;
          snapshot: AgentHistoryRlmToolCallRecord;
          blocks: string[];
          blockToolCallIds: string[];
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

        const assistantContext = assistantRunPythonForStart(
            records,
            pendingStart.at,
            pendingStart.toolCallId,
            pendingStart.code
        );
        const blocks = assistantContext?.blocks ?? [pendingStart.code];
        const blockToolCallIds = assistantContext?.blockToolCallIds ?? [pendingStart.toolCallId];
        const matchedByToolCallId = blockToolCallIds.indexOf(pendingStart.toolCallId);
        const matchedByCode = blocks.indexOf(pendingStart.code);
        const blockIndex = matchedByToolCallId >= 0 ? matchedByToolCallId : matchedByCode >= 0 ? matchedByCode : 0;

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
            blockToolCallIds,
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
        blockToolCallIds: latestAssistant.blockToolCallIds,
        blockIndex: 0,
        assistantAt: latestAssistant.assistantAt,
        historyResponseText: latestAssistant.historyResponseText
    };
}

function latestAssistantRunPythonResolve(records: AgentHistoryRecord[]): AssistantRunPythonContext | null {
    const assistantTextByAt = new Map<number, string>();
    const assistantAts: number[] = [];
    const runPythonByAssistantAt = new Map<number, AssistantRunPythonContext>();
    for (const record of records) {
        if (record.type === "assistant_message") {
            assistantTextByAt.set(record.at, record.text);
            assistantAts.push(record.at);
            if (record.toolCalls && record.toolCalls.length > 0) {
                const runPythonCalls = runPythonCallsExtract(record.toolCalls);
                if (runPythonCalls.length > 0) {
                    runPythonByAssistantAt.set(record.at, {
                        assistantAt: record.at,
                        historyResponseText: record.text,
                        blocks: runPythonCalls.map((call) => call.code),
                        blockToolCallIds: runPythonCalls.map((call) => call.toolCallId)
                    });
                }
            }
            continue;
        }
        if (record.type === "assistant_rewrite" && assistantTextByAt.has(record.assistantAt)) {
            assistantTextByAt.set(record.assistantAt, record.text);
            const runPython = runPythonByAssistantAt.get(record.assistantAt);
            if (runPython) {
                runPythonByAssistantAt.set(record.assistantAt, {
                    ...runPython,
                    historyResponseText: record.text
                });
            }
        }
    }
    for (let index = assistantAts.length - 1; index >= 0; index -= 1) {
        const assistantAt = assistantAts[index]!;
        const runPython = runPythonByAssistantAt.get(assistantAt);
        if (!runPython || runPython.blocks.length === 0) {
            continue;
        }
        return runPython;
    }
    return null;
}

function assistantRunPythonForStart(
    records: AgentHistoryRecord[],
    startAt: number,
    startToolCallId: string,
    startCode: string
): AssistantRunPythonContext | null {
    const candidates: AssistantRunPythonContext[] = [];
    const assistantTextByAt = new Map<number, string>();
    for (const record of records) {
        if (record.type === "assistant_message" && record.at <= startAt) {
            assistantTextByAt.set(record.at, record.text);
            if (record.toolCalls && record.toolCalls.length > 0) {
                const runPythonCalls = runPythonCallsExtract(record.toolCalls);
                if (runPythonCalls.length > 0) {
                    candidates.push({
                        assistantAt: record.at,
                        historyResponseText: record.text,
                        blocks: runPythonCalls.map((call) => call.code),
                        blockToolCallIds: runPythonCalls.map((call) => call.toolCallId)
                    });
                }
            }
            continue;
        }
        if (
            record.type === "assistant_rewrite" &&
            record.assistantAt <= startAt &&
            assistantTextByAt.has(record.assistantAt)
        ) {
            assistantTextByAt.set(record.assistantAt, record.text);
            for (let index = 0; index < candidates.length; index += 1) {
                const candidate = candidates[index];
                if (candidate && candidate.assistantAt === record.assistantAt) {
                    candidates[index] = { ...candidate, historyResponseText: record.text };
                }
            }
        }
    }
    candidates.sort((a, b) => b.assistantAt - a.assistantAt);
    for (const candidate of candidates) {
        if (candidate.blockToolCallIds.includes(startToolCallId)) {
            return candidate;
        }
    }
    for (const candidate of candidates) {
        if (candidate.blocks.some((code) => code === startCode)) {
            return candidate;
        }
    }
    return candidates[0] ?? null;
}

function runPythonCallsExtract(
    toolCalls: Array<{ type: "toolCall"; id: string; name: string; arguments: Record<string, unknown> }>
): Array<{ toolCallId: string; code: string }> {
    const runPythonCalls: Array<{ toolCallId: string; code: string }> = [];
    for (const toolCall of toolCalls) {
        if (toolCall.name !== RLM_TOOL_NAME) {
            continue;
        }
        const code = toolCall.arguments.code;
        if (typeof code !== "string" || code.trim().length === 0) {
            continue;
        }
        runPythonCalls.push({
            toolCallId: toolCall.id,
            code
        });
    }
    return runPythonCalls;
}
