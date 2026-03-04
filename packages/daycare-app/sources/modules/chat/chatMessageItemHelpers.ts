import type { AgentAssistantContentBlock, AgentHistoryRecord } from "./chatHistoryTypes";

/** Extracts plain text from assistant content blocks. */
export function extractText(content: AgentAssistantContentBlock[]): string {
    return content
        .filter((b): b is { type: "text"; text: string } => b.type === "text")
        .map((b) => b.text)
        .join("\n");
}

/** Returns which visual style a record should use, or null to skip. */
export function recordDisplayKind(record: AgentHistoryRecord): "user" | "assistant" | "tool" | "note" | null {
    switch (record.type) {
        case "user_message":
            return "user";
        case "assistant_message":
            return "assistant";
        case "rlm_tool_call":
            return "tool";
        case "note":
            return "note";
        default:
            return null;
    }
}
