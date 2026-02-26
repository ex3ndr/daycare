import type { Context, ToolCall } from "@mariozechner/pi-ai";

/**
 * Extracts native tool-call blocks from an assistant message.
 * Expects: message is a context message from provider output.
 */
export function messageExtractToolCalls(message: Context["messages"][number]): ToolCall[] {
    if (message.role !== "assistant") {
        return [];
    }
    return message.content.filter((block): block is ToolCall => block.type === "toolCall");
}
