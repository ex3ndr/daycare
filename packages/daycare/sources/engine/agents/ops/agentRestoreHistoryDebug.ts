import type { AgentHistoryRecord } from "@/types";
import { stringTruncateHeadTail } from "../../../utils/stringTruncateHeadTail.js";
import { messageContentExtractText } from "../../messages/messageContentExtractText.js";
import { messageContentExtractToolCalls } from "../../messages/messageContentExtractToolCalls.js";
import { RLM_TOOL_NAME } from "../../modules/rlm/rlmConstants.js";

const RLM_RESULT_MAX_CHARS = 16_000;
const MISSING_RUN_PYTHON_RESULT_MESSAGE = "Daycare server was restarted before executing this command.";

/**
 * Builds restore debug stats that reflect the approximate rebuilt context shape.
 * Expects: records belong to one session and are ordered chronologically.
 */
export function agentRestoreHistoryDebug(records: AgentHistoryRecord[]) {
    const typeCounts: Record<string, number> = {};
    const skippedTypeCounts: Record<string, number> = {};
    const rebuilt = {
        userMessageCount: 0,
        assistantMessageCount: 0,
        toolResultCount: 0,
        assistantRewriteCount: 0,
        messageCount: 0,
        textChars: 0
    };
    const assistantTextLengthByAt = new Map<number, number>();
    let lastAssistantAt: number | null = null;
    let fileCount = 0;
    let oldestAt: number | null = null;
    let newestAt: number | null = null;

    const completionByToolCallId = completionByToolCallIdResolve(records);
    const unresolvedStartToolCallIds = unresolvedStartToolCallIdsResolve(records);

    for (const record of records) {
        typeCounts[record.type] = (typeCounts[record.type] ?? 0) + 1;
        oldestAt = oldestAt === null ? record.at : Math.min(oldestAt, record.at);
        newestAt = newestAt === null ? record.at : Math.max(newestAt, record.at);

        switch (record.type) {
            case "user_message":
                rebuilt.userMessageCount += 1;
                rebuilt.messageCount += 1;
                rebuilt.textChars += record.text.length;
                fileCount += record.files.length;
                continue;
            case "assistant_message": {
                const assistantTextLength = messageContentExtractText(record.content)?.length ?? 0;
                rebuilt.assistantMessageCount += 1;
                rebuilt.messageCount += 1;
                rebuilt.textChars += assistantTextLength;
                assistantTextLengthByAt.set(record.at, assistantTextLength);
                lastAssistantAt = record.at;

                for (const toolCall of messageContentExtractToolCalls(record.content)) {
                    if (toolCall.name !== RLM_TOOL_NAME) {
                        continue;
                    }
                    if (unresolvedStartToolCallIds.has(toolCall.id)) {
                        continue;
                    }
                    const completion =
                        completionByToolCallId.get(toolCall.id) ??
                        missingRlmCompletionRecordBuild(toolCall.id, record.at);
                    rebuilt.toolResultCount += 1;
                    rebuilt.messageCount += 1;
                    rebuilt.textChars += rlmHistoryResultTextBuild(completion).length;
                }
                continue;
            }
            case "assistant_rewrite": {
                const assistantAt = assistantTextLengthByAt.has(record.assistantAt)
                    ? record.assistantAt
                    : lastAssistantAt;
                if (assistantAt === null) {
                    skippedTypeCounts[record.type] = (skippedTypeCounts[record.type] ?? 0) + 1;
                    continue;
                }
                const previousLength = assistantTextLengthByAt.get(assistantAt) ?? 0;
                assistantTextLengthByAt.set(assistantAt, record.text.length);
                rebuilt.assistantRewriteCount += 1;
                rebuilt.textChars += record.text.length - previousLength;
                continue;
            }
            default:
                skippedTypeCounts[record.type] = (skippedTypeCounts[record.type] ?? 0) + 1;
                continue;
        }
    }

    return {
        recordCount: records.length,
        oldestAt,
        newestAt,
        fileCount,
        rebuilt,
        skippedTypeCounts,
        typeCounts
    };
}

function completionByToolCallIdResolve(
    records: AgentHistoryRecord[]
): Map<string, Extract<AgentHistoryRecord, { type: "rlm_complete" }>> {
    const completionByToolCallId = new Map<string, Extract<AgentHistoryRecord, { type: "rlm_complete" }>>();
    for (const record of records) {
        if (record.type !== "rlm_complete") {
            continue;
        }
        if (completionByToolCallId.has(record.toolCallId)) {
            continue;
        }
        completionByToolCallId.set(record.toolCallId, record);
    }
    return completionByToolCallId;
}

function unresolvedStartToolCallIdsResolve(records: AgentHistoryRecord[]): Set<string> {
    const started = new Set<string>();
    const completed = new Set<string>();
    for (const record of records) {
        if (record.type === "rlm_start") {
            started.add(record.toolCallId);
            continue;
        }
        if (record.type === "rlm_complete") {
            completed.add(record.toolCallId);
        }
    }
    const unresolved = new Set<string>();
    for (const toolCallId of started) {
        if (!completed.has(toolCallId)) {
            unresolved.add(toolCallId);
        }
    }
    return unresolved;
}

function missingRlmCompletionRecordBuild(
    toolCallId: string,
    at: number
): Extract<AgentHistoryRecord, { type: "rlm_complete" }> {
    return {
        type: "rlm_complete",
        at,
        toolCallId,
        output: "",
        printOutput: [],
        toolCallCount: 0,
        isError: true,
        error: MISSING_RUN_PYTHON_RESULT_MESSAGE
    };
}

function rlmHistoryResultTextBuild(record: Extract<AgentHistoryRecord, { type: "rlm_complete" }>): string {
    const printOutputText = record.printOutput.length > 0 ? record.printOutput.join("\n") : "(none)";
    if (record.isError) {
        const errorText = record.error && record.error.length > 0 ? record.error : "Python execution failed.";
        const text = [
            "Python execution failed.",
            `Tool calls: ${record.toolCallCount}`,
            `Print output:\n${printOutputText}`,
            `Error:\n${errorText}`
        ].join("\n\n");
        return stringTruncateHeadTail(text, RLM_RESULT_MAX_CHARS, "python result");
    }
    const outputText = record.output.length > 0 ? record.output : "(empty)";
    const text = [
        "Python execution completed.",
        `Tool calls: ${record.toolCallCount}`,
        `Print output:\n${printOutputText}`,
        `Output:\n${outputText}`
    ].join("\n\n");
    return stringTruncateHeadTail(text, RLM_RESULT_MAX_CHARS, "python result");
}
