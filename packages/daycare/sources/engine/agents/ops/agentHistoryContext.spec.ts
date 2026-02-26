import { describe, expect, it } from "vitest";

import type { AgentHistoryRecord } from "@/types";
import { agentHistoryContext } from "./agentHistoryContext.js";

describe("agentHistoryContext", () => {
    it("skips RLM checkpoint records while rebuilding context messages", async () => {
        const records: AgentHistoryRecord[] = [
            { type: "user_message", at: 3, text: "run", files: [] },
            {
                type: "assistant_message",
                at: 4,
                text: "Working on it",
                files: [],
                tokens: null
            },
            {
                type: "rlm_start",
                at: 5,
                toolCallId: "run-python-1",
                code: "echo('x')",
                preamble: "..."
            },
            {
                type: "rlm_tool_call",
                at: 6,
                toolCallId: "run-python-1",
                snapshotId: "snapshot-id",
                printOutput: [],
                toolCallCount: 0,
                toolName: "echo",
                toolArgs: { text: "x" }
            },
            {
                type: "rlm_tool_result",
                at: 7,
                toolCallId: "run-python-1",
                toolName: "echo",
                toolResult: "x",
                toolIsError: false
            },
            {
                type: "rlm_complete",
                at: 8,
                toolCallId: "run-python-1",
                output: "x",
                printOutput: [],
                toolCallCount: 1,
                isError: false
            }
        ];

        const messages = await agentHistoryContext(records, "agent-1");

        expect(messages).toHaveLength(2);
        expect(messages[0]?.role).toBe("user");
        expect(messages[1]?.role).toBe("assistant");
    });

    it("replays assistant tool calls and matching rlm_complete as tool results", async () => {
        const records: AgentHistoryRecord[] = [
            {
                type: "assistant_message",
                at: 10,
                text: "",
                files: [],
                tokens: null,
                toolCalls: [
                    {
                        type: "toolCall",
                        id: "tool-1",
                        name: "run_python",
                        arguments: { code: "exec(command='sleep 60')" }
                    }
                ]
            },
            {
                type: "rlm_complete",
                at: 11,
                toolCallId: "tool-1",
                output: "",
                printOutput: ["started"],
                toolCallCount: 1,
                isError: true,
                error: "Daycare server was restarted during executing this command"
            },
            {
                type: "user_message",
                at: 12,
                text: "yo",
                files: []
            }
        ];

        const messages = await agentHistoryContext(records, "agent-1");

        expect(messages).toHaveLength(3);
        const assistant = messages[0];
        const toolResult = messages[1];
        const user = messages[2];
        expect(assistant?.role).toBe("assistant");
        if (!assistant || assistant.role !== "assistant") {
            throw new Error("Expected assistant message.");
        }
        expect(assistant.content).toEqual([
            {
                type: "toolCall",
                id: "tool-1",
                name: "run_python",
                arguments: { code: "exec(command='sleep 60')" }
            }
        ]);
        expect(toolResult?.role).toBe("toolResult");
        if (!toolResult || toolResult.role !== "toolResult") {
            throw new Error("Expected toolResult message.");
        }
        expect(toolResult.toolCallId).toBe("tool-1");
        expect(toolResult.toolName).toBe("run_python");
        expect(toolResult.isError).toBe(true);
        const textPart = toolResult.content.find((part) => part.type === "text");
        expect(textPart && "text" in textPart ? textPart.text : "").toContain(
            "Daycare server was restarted during executing this command"
        );
        expect(user?.role).toBe("user");
    });

    it("replays assistant_rewrite records during restore", async () => {
        const records: AgentHistoryRecord[] = [
            {
                type: "assistant_message",
                at: 2,
                text: "before<run_python>echo()</run_python>",
                files: [],
                tokens: null
            },
            {
                type: "assistant_rewrite",
                at: 3,
                assistantAt: 2,
                text: "before<run_python>echo()</run_python>",
                reason: "run_python_failure_trim"
            }
        ];

        const messages = await agentHistoryContext(records, "agent-1");

        expect(messages).toHaveLength(1);
        const assistant = messages[0];
        expect(assistant?.role).toBe("assistant");
        if (!assistant || assistant.role !== "assistant") {
            throw new Error("Expected assistant message.");
        }
        const textPart = assistant.content.find((part) => part.type === "text");
        expect(textPart && "text" in textPart ? textPart.text : "").toBe("before<run_python>echo()</run_python>");
    });

    it("applies assistant_rewrite to the assistantAt target when newer assistant messages exist", async () => {
        const records: AgentHistoryRecord[] = [
            {
                type: "assistant_message",
                at: 10,
                text: "first raw",
                files: [],
                tokens: null
            },
            {
                type: "assistant_message",
                at: 20,
                text: "second untouched",
                files: [],
                tokens: null
            },
            {
                type: "assistant_rewrite",
                at: 30,
                assistantAt: 10,
                text: "first rewritten",
                reason: "run_python_failure_trim"
            }
        ];

        const messages = await agentHistoryContext(records, "agent-1");
        expect(messages).toHaveLength(2);

        const first = messages[0];
        const second = messages[1];
        if (!first || first.role !== "assistant") {
            throw new Error("Expected first assistant message.");
        }
        if (!second || second.role !== "assistant") {
            throw new Error("Expected second assistant message.");
        }

        const firstTextPart = first.content.find((part) => part.type === "text");
        const secondTextPart = second.content.find((part) => part.type === "text");
        expect(firstTextPart && "text" in firstTextPart ? firstTextPart.text : "").toBe("first rewritten");
        expect(secondTextPart && "text" in secondTextPart ? secondTextPart.text : "").toBe("second untouched");
    });
});
