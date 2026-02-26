import type { AssistantMessage, ToolCall } from "@mariozechner/pi-ai";

/**
 * Extracts tool-call blocks from assistant content.
 * Expects: content blocks come from an assistant message payload.
 */
export function messageContentExtractToolCalls(content: AssistantMessage["content"]): ToolCall[] {
    return content.filter((block): block is ToolCall => block.type === "toolCall");
}
