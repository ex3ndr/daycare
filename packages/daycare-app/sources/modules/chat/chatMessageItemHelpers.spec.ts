import { describe, expect, it } from "vitest";
import type { AgentHistoryRecord } from "./chatHistoryTypes";
import { extractText, recordDisplayKind } from "./chatMessageItemHelpers";

describe("extractText", () => {
    it("extracts text blocks and joins with newline", () => {
        const content = [
            { type: "text" as const, text: "Hello" },
            { type: "tool_use" as const, id: "t1", name: "run", input: {} },
            { type: "text" as const, text: "World" }
        ];
        expect(extractText(content)).toBe("Hello\nWorld");
    });

    it("returns empty string for no text blocks", () => {
        const content = [{ type: "tool_use" as const, id: "t1", name: "run", input: {} }];
        expect(extractText(content)).toBe("");
    });

    it("returns empty string for empty array", () => {
        expect(extractText([])).toBe("");
    });
});

describe("recordDisplayKind", () => {
    it("returns 'user' for user_message", () => {
        const record: AgentHistoryRecord = { type: "user_message", at: 1000, text: "hi" };
        expect(recordDisplayKind(record)).toBe("user");
    });

    it("returns 'assistant' for assistant_message", () => {
        const record: AgentHistoryRecord = {
            type: "assistant_message",
            at: 1000,
            content: [{ type: "text", text: "hi" }]
        };
        expect(recordDisplayKind(record)).toBe("assistant");
    });

    it("returns 'tool' for rlm_tool_call", () => {
        const record: AgentHistoryRecord = {
            type: "rlm_tool_call",
            at: 1000,
            toolName: "run_python",
            toolCallCount: 1
        };
        expect(recordDisplayKind(record)).toBe("tool");
    });

    it("returns 'note' for note", () => {
        const record: AgentHistoryRecord = { type: "note", at: 1000, text: "hello" };
        expect(recordDisplayKind(record)).toBe("note");
    });

    it("returns 'tool' for rlm_start with a description", () => {
        const record: AgentHistoryRecord = { type: "rlm_start", at: 1000, description: "Check cwd" };
        expect(recordDisplayKind(record)).toBe("tool");
    });

    it("returns null for rlm_start without a description", () => {
        const record: AgentHistoryRecord = { type: "rlm_start", at: 1000 };
        expect(recordDisplayKind(record)).toBeNull();
    });

    it("returns null for rlm_complete", () => {
        const record: AgentHistoryRecord = { type: "rlm_complete", at: 1000 };
        expect(recordDisplayKind(record)).toBeNull();
    });

    it("returns null for rlm_tool_result", () => {
        const record: AgentHistoryRecord = { type: "rlm_tool_result", at: 1000 };
        expect(recordDisplayKind(record)).toBeNull();
    });

    it("returns null for assistant_rewrite", () => {
        const record: AgentHistoryRecord = { type: "assistant_rewrite", at: 1000 };
        expect(recordDisplayKind(record)).toBeNull();
    });
});
