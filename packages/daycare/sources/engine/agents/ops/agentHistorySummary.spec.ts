import { describe, expect, it } from "vitest";
import type { AgentHistoryRecord } from "@/types";
import { agentHistorySummary } from "./agentHistorySummary.js";

function buildRecord(record: AgentHistoryRecord): AgentHistoryRecord {
    return record;
}

describe("agentHistorySummary", () => {
    it("returns zeroed summary for empty history", () => {
        const summary = agentHistorySummary([]);

        expect(summary.recordCount).toBe(0);
        expect(summary.firstAt).toBeNull();
        expect(summary.lastAt).toBeNull();
        expect(summary.counts).toEqual({
            user_message: 0,
            assistant_message: 0,
            tool_result: 0,
            rlm_start: 0,
            rlm_tool_call: 0,
            rlm_tool_result: 0,
            rlm_complete: 0,
            assistant_rewrite: 0,
            note: 0
        });
    });

    it("tracks counts, time range, and latest text snapshots", () => {
        const records: AgentHistoryRecord[] = [
            buildRecord({ type: "user_message", at: 110, text: "hi", files: [] }),
            buildRecord({
                type: "assistant_message",
                at: 120,
                text: "hello",
                files: [],
                toolCalls: [],
                tokens: null
            }),
            buildRecord({
                type: "assistant_rewrite",
                at: 125,
                assistantAt: 120,
                text: "hello revised",
                reason: "run_python_say_after_trim"
            }),
            buildRecord({
                type: "tool_result",
                at: 130,
                toolCallId: "tool-1",
                output: {
                    toolMessage: {
                        role: "toolResult",
                        toolCallId: "tool-1",
                        toolName: "send_agent_message",
                        content: [{ type: "text", text: "sent" }],
                        isError: false,
                        timestamp: 130
                    },
                    typedResult: { text: "sent" }
                }
            }),
            buildRecord({ type: "note", at: 140, text: "done" })
        ];

        const summary = agentHistorySummary(records);

        expect(summary.recordCount).toBe(5);
        expect(summary.firstAt).toBe(110);
        expect(summary.lastAt).toBe(140);
        expect(summary.counts).toEqual({
            user_message: 1,
            assistant_message: 1,
            tool_result: 1,
            rlm_start: 0,
            rlm_tool_call: 0,
            rlm_tool_result: 0,
            rlm_complete: 0,
            assistant_rewrite: 1,
            note: 1
        });
        expect(summary.lastUserMessage).toBe("hi");
        expect(summary.lastAssistantMessage).toBe("hello revised");
        expect(summary.lastNote).toBe("done");
        expect(summary.lastToolName).toBe("send_agent_message");
    });
});
