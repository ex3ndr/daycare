import type { ToolResultMessage } from "@mariozechner/pi-ai";

import type { AgentHistoryRecord } from "@/types";

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

            case "assistant_message":
                if (record.text.length > 0) {
                    parts.push(`## ${assistantLabel}\n\n${record.text}`);
                }
                for (const toolCall of record.toolCalls) {
                    const args = JSON.stringify(toolCall.arguments, null, 2);
                    parts.push(`### Tool Call: ${toolCall.name}\n\n\`\`\`\n${args}\n\`\`\``);
                }
                break;

            case "tool_result": {
                const text = toolResultExtractText(record.output.toolMessage.content);
                parts.push(`### Tool Result\n\n\`\`\`\n${text}\n\`\`\``);
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

/** Extracts text from ToolResultMessage content blocks. */
function toolResultExtractText(content: ToolResultMessage["content"]): string {
    if (!Array.isArray(content)) {
        return String(content);
    }
    const texts = content
        .filter(
            (part): part is { type: "text"; text: string } => part?.type === "text" && typeof part.text === "string"
        )
        .map((part) => part.text);
    return texts.length > 0 ? texts.join("\n") : JSON.stringify(content);
}
