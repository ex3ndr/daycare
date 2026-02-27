import type { AgentHistoryRecord } from "@/types";
import { messageContentExtractText } from "../../../messages/messageContentExtractText.js";

/**
 * Formats agent history records into a human-readable markdown transcript.
 * When isForeground is false, labels are "System Message"/"Agent" instead of "User"/"Assistant".
 *
 * Expects: records are in chronological order from a single session.
 */
export function formatHistoryMessages(records: AgentHistoryRecord[], isForeground = true): string {
    const userLabel = isForeground ? "User" : "System Message";
    const assistantLabel = isForeground ? "Assistant" : "Agent";
    const parts: string[] = [];

    for (const record of records) {
        switch (record.type) {
            case "user_message":
                parts.push(`## ${userLabel}\n\n${record.text}`);
                break;

            case "assistant_message": {
                const assistantText = messageContentExtractText(record.content);
                if (assistantText.length > 0) {
                    parts.push(`## ${assistantLabel}\n\n${assistantText}`);
                }
                break;
            }

            case "note":
                parts.push(`> Note: ${record.text}`);
                break;

            // Skip rlm_* and assistant_rewrite records — internal implementation details
            default:
                break;
        }
    }

    return parts.join("\n\n");
}
