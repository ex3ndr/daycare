import type { AgentHistoryRecord } from "@/types";
import { messageContentExtractText } from "../../messages/messageContentExtractText.js";

/**
 * Builds lightweight debug stats for one restored session history.
 * Expects: records belong to one session and are ordered chronologically.
 */
export function agentRestoreHistoryDebug(records: AgentHistoryRecord[]) {
    const typeCounts: Record<string, number> = {};
    let fileCount = 0;
    let textChars = 0;
    let oldestAt: number | null = null;
    let newestAt: number | null = null;

    for (const record of records) {
        typeCounts[record.type] = (typeCounts[record.type] ?? 0) + 1;
        oldestAt = oldestAt === null ? record.at : Math.min(oldestAt, record.at);
        newestAt = newestAt === null ? record.at : Math.max(newestAt, record.at);

        switch (record.type) {
            case "user_message":
                textChars += record.text.length;
                fileCount += record.files.length;
                break;
            case "assistant_message":
                textChars += messageContentExtractText(record.content)?.length ?? 0;
                break;
            case "rlm_start":
                textChars += record.code.length + record.preamble.length + (record.description?.length ?? 0);
                break;
            case "rlm_tool_call":
                textChars += record.toolName.length + record.printOutput.join("\n").length;
                break;
            case "rlm_tool_result":
                textChars += record.toolName.length + record.toolResult.length;
                break;
            case "rlm_complete":
                textChars += record.output.length + record.printOutput.join("\n").length + (record.error?.length ?? 0);
                break;
            case "assistant_rewrite":
            case "note":
                textChars += record.text.length;
                break;
        }
    }

    return {
        recordCount: records.length,
        oldestAt,
        newestAt,
        fileCount,
        textChars,
        typeCounts
    };
}
