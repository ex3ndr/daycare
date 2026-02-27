import type { Context } from "@mariozechner/pi-ai";
import { createId } from "@paralleldrive/cuid2";

import type { AgentHistoryRecord, AgentMessage, MessageContext } from "@/types";
import { stringTruncateHeadTail } from "../../../utils/stringTruncateHeadTail.js";
import { messageBuildUser } from "../../messages/messageBuildUser.js";
import { messageContentClone } from "../../messages/messageContentClone.js";
import { messageContentExtractToolCalls } from "../../messages/messageContentExtractToolCalls.js";
import { messageFormatIncoming } from "../../messages/messageFormatIncoming.js";
import { RLM_TOOL_NAME } from "../../modules/rlm/rlmConstants.js";

const RLM_RESULT_MAX_CHARS = 16_000;

/**
 * Rebuilds conversation context messages from persisted history records.
 * Expects: records are in chronological order and belong to one agent.
 */
export async function agentHistoryContext(
    records: AgentHistoryRecord[],
    _agentId: string
): Promise<Context["messages"]> {
    const messages: Context["messages"] = [];
    const assistantToolCallIds = new Set<string>();
    let lastAssistantMessageIndex: number | null = null;
    const assistantMessageIndexByAt = new Map<number, number>();
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
            if (!assistantToolCallIds.has(record.toolCallId)) {
                continue;
            }
            messages.push({
                role: "toolResult",
                toolCallId: record.toolCallId,
                toolName: RLM_TOOL_NAME,
                content: [{ type: "text", text: rlmHistoryResultTextBuild(record) }],
                isError: record.isError,
                timestamp: record.at
            });
            continue;
        }
        if (record.type === "user_message") {
            const context: MessageContext = {
                ...(record.enrichments ? { enrichments: record.enrichments.map((item) => ({ ...item })) } : {})
            };
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
            const content = messageContentClone(record.content);
            for (const toolCall of messageContentExtractToolCalls(content)) {
                assistantToolCallIds.add(toolCall.id);
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
        }
    }
    return messages;
}

function rlmHistoryResultTextBuild(record: Extract<AgentHistoryRecord, { type: "rlm_complete" }>): string {
    const printOutputText = record.printOutput.length > 0 ? record.printOutput.join("\n") : "(none)";
    if (record.isError) {
        const errorText = record.error && record.error.length > 0 ? record.error : "Python execution failed.";
        const text = [
            "Python execution failed.",
            `Tool calls: ${record.toolCallCount}`,
            `Print output:\n${printOutputText}`,
            `Error:\n${errorText}`
        ].join("\n\n");
        return stringTruncateHeadTail(text, RLM_RESULT_MAX_CHARS, "python result");
    }
    const outputText = record.output.length > 0 ? record.output : "(empty)";
    const text = [
        "Python execution completed.",
        `Tool calls: ${record.toolCallCount}`,
        `Print output:\n${printOutputText}`,
        `Output:\n${outputText}`
    ].join("\n\n");
    return stringTruncateHeadTail(text, RLM_RESULT_MAX_CHARS, "python result");
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
