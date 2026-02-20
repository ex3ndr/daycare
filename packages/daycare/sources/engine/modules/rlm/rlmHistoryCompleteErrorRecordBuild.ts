import type { AgentHistoryRecord } from "@/types";

/**
 * Builds an rlm_complete history record for failed run_python execution.
 * Expects: toolCallId is the outer run_python tool call id.
 */
export function rlmHistoryCompleteErrorRecordBuild(
    toolCallId: string,
    message: string,
    printOutput: string[] = [],
    toolCallCount = 0
): AgentHistoryRecord {
    return {
        type: "rlm_complete",
        at: Date.now(),
        toolCallId,
        output: "",
        printOutput: [...printOutput],
        toolCallCount,
        isError: true,
        error: message
    };
}
