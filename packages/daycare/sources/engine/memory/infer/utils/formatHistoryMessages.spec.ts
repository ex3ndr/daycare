import { describe, expect, it } from "vitest";

import type { AgentHistoryRecord } from "@/types";
import { formatHistoryMessages } from "./formatHistoryMessages.js";

describe("formatHistoryMessages", () => {
    it("returns empty string for empty records", () => {
        expect(formatHistoryMessages([])).toBe("");
    });

    it("formats user message", () => {
        const records: AgentHistoryRecord[] = [{ type: "user_message", at: 1000, text: "Hello there", files: [] }];
        expect(formatHistoryMessages(records)).toBe("## User\n\nHello there");
    });

    it("formats assistant message with text", () => {
        const records: AgentHistoryRecord[] = [
            {
                type: "assistant_message",
                at: 1000,
                text: "Hi!",
                files: [],
                toolCalls: [],
                tokens: null
            }
        ];
        expect(formatHistoryMessages(records)).toBe("## Assistant\n\nHi!");
    });

    it("formats assistant message with tool calls", () => {
        const records: AgentHistoryRecord[] = [
            {
                type: "assistant_message",
                at: 1000,
                text: "Let me check.",
                files: [],
                toolCalls: [{ type: "toolCall", id: "tc1", name: "read_file", arguments: { path: "/tmp/a.txt" } }],
                tokens: null
            }
        ];
        const result = formatHistoryMessages(records);
        expect(result).toContain("## Assistant\n\nLet me check.");
        expect(result).toContain("### Tool Call: read_file");
        expect(result).toContain("/tmp/a.txt");
    });

    it("formats note records", () => {
        const records: AgentHistoryRecord[] = [{ type: "note", at: 1000, text: "session started" }];
        expect(formatHistoryMessages(records)).toBe("> Note: session started");
    });

    it("skips rlm_start records", () => {
        const records: AgentHistoryRecord[] = [
            { type: "rlm_start", at: 1000, toolCallId: "tc1", code: "x", preamble: "y" }
        ];
        expect(formatHistoryMessages(records)).toBe("");
    });

    it("formats tool result with text content", () => {
        const records = [
            {
                type: "tool_result" as const,
                at: 1000,
                toolCallId: "tc1",
                output: {
                    toolMessage: {
                        role: "tool" as const,
                        toolCallId: "tc1",
                        toolName: "read_file",
                        isError: false,
                        timestamp: 1000,
                        content: [{ type: "text" as const, text: "file contents here" }]
                    },
                    typedResult: {}
                }
            }
        ] as unknown as AgentHistoryRecord[];
        const result = formatHistoryMessages(records);
        expect(result).toContain("### Tool Result");
        expect(result).toContain("file contents here");
    });

    it("joins multiple records with double newlines", () => {
        const records: AgentHistoryRecord[] = [
            { type: "user_message", at: 1000, text: "Q", files: [] },
            {
                type: "assistant_message",
                at: 1001,
                text: "A",
                files: [],
                toolCalls: [],
                tokens: null
            }
        ];
        const result = formatHistoryMessages(records);
        expect(result).toBe("## User\n\nQ\n\n## Assistant\n\nA");
    });

    it("uses background labels when isForeground is false", () => {
        const records: AgentHistoryRecord[] = [
            { type: "user_message", at: 1000, text: "run task", files: [] },
            {
                type: "assistant_message",
                at: 1001,
                text: "Done.",
                files: [],
                toolCalls: [],
                tokens: null
            }
        ];
        const result = formatHistoryMessages(records, false);
        expect(result).toBe("## System Message\n\nrun task\n\n## Agent\n\nDone.");
    });

    it("uses foreground labels by default", () => {
        const records: AgentHistoryRecord[] = [{ type: "user_message", at: 1000, text: "hi", files: [] }];
        expect(formatHistoryMessages(records)).toBe("## User\n\nhi");
        expect(formatHistoryMessages(records, true)).toBe("## User\n\nhi");
    });
});
