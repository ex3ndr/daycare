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
                content: [{ type: "text", text: "Hi!" }],
                tokens: null
            }
        ];
        expect(formatHistoryMessages(records)).toBe("## Assistant\n\nHi!");
    });

    it("formats note records", () => {
        const records: AgentHistoryRecord[] = [{ type: "note", at: 1000, text: "session started" }];
        expect(formatHistoryMessages(records)).toBe("> Note: session started");
    });

    it("skips internal RLM records", () => {
        const records: AgentHistoryRecord[] = [
            { type: "rlm_start", at: 1000, toolCallId: "tc1", code: "x", preamble: "y" },
            {
                type: "rlm_tool_call",
                at: 1001,
                toolCallId: "tc1",
                snapshotId: "snapshot-id",
                printOutput: [],
                toolCallCount: 0,
                toolName: "read",
                toolArgs: {}
            },
            {
                type: "rlm_tool_result",
                at: 1002,
                toolCallId: "tc1",
                toolName: "read",
                toolResult: "ok",
                toolIsError: false
            },
            {
                type: "rlm_complete",
                at: 1003,
                toolCallId: "tc1",
                output: "ok",
                printOutput: [],
                toolCallCount: 1,
                isError: false
            }
        ];
        expect(formatHistoryMessages(records)).toBe("");
    });

    it("joins multiple records with double newlines", () => {
        const records: AgentHistoryRecord[] = [
            { type: "user_message", at: 1000, text: "Q", files: [] },
            {
                type: "assistant_message",
                at: 1001,
                content: [{ type: "text", text: "A" }],
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
                content: [{ type: "text", text: "Done." }],
                tokens: null
            }
        ];
        const result = formatHistoryMessages(records, false);
        expect(result).toBe("## System Message\n\nrun task\n\n## Agent\n\nDone.");
    });

    it("rewrites wrapped system_message text to avoid nested tags", () => {
        const records: AgentHistoryRecord[] = [
            {
                type: "user_message",
                at: 1000,
                text: '<system_message origin="cron">[cron]\ntriggerId: test-1</system_message>',
                files: []
            }
        ];
        const result = formatHistoryMessages(records, false);
        expect(result).toContain("## System Message");
        expect(result).toContain("> System message (origin: cron)");
        expect(result).toContain("[cron]\ntriggerId: test-1");
        expect(result).not.toContain("<system_message");
    });

    it("rewrites wrapped system_message_silent text and keeps inner content", () => {
        const records: AgentHistoryRecord[] = [
            {
                type: "user_message",
                at: 1000,
                text: "<system_message_silent>quiet update</system_message_silent>",
                files: []
            }
        ];
        const result = formatHistoryMessages(records);
        expect(result).toBe("## User\n\n> Silent system message\n\nquiet update");
    });

    it("adds line breaks between adjacent tags inside wrapped system messages", () => {
        const records: AgentHistoryRecord[] = [
            {
                type: "user_message",
                at: 1000,
                text: '<system_message origin="cron"><timezone>UTC</timezone><time>12:00</time><message>run</message></system_message>',
                files: []
            }
        ];
        const result = formatHistoryMessages(records, false);
        expect(result).toContain("<timezone>UTC</timezone>\n<time>12:00</time>\n<message>run</message>");
    });
});
