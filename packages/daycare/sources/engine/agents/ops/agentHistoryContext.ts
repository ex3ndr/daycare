import type { Context, ToolCall } from "@mariozechner/pi-ai";
import { createId } from "@paralleldrive/cuid2";

import type { AgentHistoryRecord, AgentMessage, MessageContext } from "@/types";
import { messageBuildUser } from "../../messages/messageBuildUser.js";
import { messageFormatIncoming } from "../../messages/messageFormatIncoming.js";

/**
 * Rebuilds conversation context messages from persisted history records.
 * Expects: records are in chronological order and belong to one agent.
 */
export async function agentHistoryContext(
    records: AgentHistoryRecord[],
    _agentId: string
): Promise<Context["messages"]> {
    const messages: Context["messages"] = [];
    let lastAssistantMessageIndex: number | null = null;
    const assistantMessageIndexByAt = new Map<number, number>();
    let pendingToolResultIds: Set<string> | null = null;
    for (const record of records) {
        if (record.type === "rlm_start") {
            continue;
        }
        if (record.type === "rlm_tool_call") {
            continue;
        }
        if (record.type === "rlm_tool_result") {
            continue;
        }
        if (record.type === "rlm_complete") {
            continue;
        }
        if (record.type === "user_message") {
            pendingToolResultIds = null;
            const context: MessageContext = {};
            const message = messageFormatIncoming(
                {
                    text: record.text,
                    files: record.files.map((file) => ({ ...file }))
                },
                context,
                new Date(record.at)
            );
            const userEntry: AgentMessage = {
                id: createId(),
                message,
                context,
                receivedAt: record.at
            };
            messages.push(await messageBuildUser(userEntry));
        }
        if (record.type === "assistant_message") {
            const content: Array<{ type: "text"; text: string } | ToolCall> = [];
            const toolCallIds = new Set<string>();
            if (record.text.length > 0) {
                content.push({ type: "text", text: record.text });
            }
            for (const toolCall of record.toolCalls) {
                content.push(toolCall);
                if (toolCallIdIs(toolCall.id)) {
                    toolCallIds.add(toolCall.id);
                }
            }
            messages.push({
                role: "assistant",
                content,
                api: "history",
                provider: "history",
                model: "history",
                usage: {
                    input: 0,
                    output: 0,
                    cacheRead: 0,
                    cacheWrite: 0,
                    totalTokens: 0,
                    cost: {
                        input: 0,
                        output: 0,
                        cacheRead: 0,
                        cacheWrite: 0,
                        total: 0
                    }
                },
                stopReason: "stop",
                timestamp: record.at
            });
            lastAssistantMessageIndex = messages.length - 1;
            assistantMessageIndexByAt.set(record.at, lastAssistantMessageIndex);
            pendingToolResultIds = toolCallIds.size > 0 ? toolCallIds : null;
            continue;
        }
        if (record.type === "assistant_rewrite") {
            const assistantIndex = assistantMessageIndexByAt.get(record.assistantAt) ?? lastAssistantMessageIndex;
            if (assistantIndex === null) {
                continue;
            }
            const assistantMessage = messages[assistantIndex];
            if (!assistantMessage || assistantMessage.role !== "assistant") {
                continue;
            }
            assistantMessageTextRewrite(assistantMessage, record.text);
            continue;
        }
        if (record.type === "tool_result") {
            if (!pendingToolResultIds || !pendingToolResultIds.has(record.toolCallId)) {
                continue;
            }
            pendingToolResultIds.delete(record.toolCallId);
            messages.push(record.output.toolMessage);
        }
    }
    return messages;
}

function toolCallIdIs(value: unknown): value is string {
    return typeof value === "string" && value.trim().length > 0;
}

function assistantMessageTextRewrite(message: Context["messages"][number], text: string): void {
    if (message.role !== "assistant") {
        return;
    }
    const nextContent: typeof message.content = [];
    let textRewritten = false;
    for (const part of message.content) {
        if (part.type !== "text") {
            nextContent.push(part);
            continue;
        }
        if (textRewritten) {
            continue;
        }
        nextContent.push({ ...part, text });
        textRewritten = true;
    }
    if (!textRewritten) {
        return;
    }
    message.content = nextContent;
}
