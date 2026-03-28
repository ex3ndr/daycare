import type { AgentHistoryRecord } from "@/types";

const COMPACTION_CONTINUE_MARKER = "Please continue with the user's latest request.";

/**
 * Detects the latest durable summary boundary that restore can safely resume from.
 * Expects: record belongs to the active session being restored.
 */
export function agentHistoryRestoreBoundaryIs(record: AgentHistoryRecord): boolean {
    return record.type === "user_message" && record.text.includes(COMPACTION_CONTINUE_MARKER);
}
