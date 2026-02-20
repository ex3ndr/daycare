import type { Context } from "@mariozechner/pi-ai";

import type { AgentMessage } from "../agents/ops/agentTypes.js";

export async function messageBuildUser(entry: AgentMessage): Promise<Context["messages"][number]> {
    const text = entry.message.text ?? "";
    const files = entry.message.files ?? [];
    if (files.length === 0) {
        return {
            role: "user",
            content: text,
            timestamp: entry.receivedAt
        };
    }

    const content: Array<{ type: "text"; text: string }> = [];
    if (text) {
        content.push({ type: "text", text });
    }

    for (const file of files) {
        content.push({
            type: "text",
            text: `File received: ${file.name} (${file.mimeType}, ${file.size} bytes) at ${file.path}`
        });
    }

    return {
        role: "user",
        content,
        timestamp: entry.receivedAt
    };
}
