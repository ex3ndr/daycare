import type { Context, ToolCall } from "@mariozechner/pi-ai";

export function messageExtractToolCalls(message: Context["messages"][number]): ToolCall[] {
    if (message.role !== "assistant") {
        return [];
    }
    return message.content.filter((block): block is ToolCall => block.type === "toolCall");
}
