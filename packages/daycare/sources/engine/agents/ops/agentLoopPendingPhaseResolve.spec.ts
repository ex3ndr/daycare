import { describe, expect, it } from "vitest";

import type { AgentHistoryRecord } from "@/types";
import { agentLoopPendingPhaseResolve } from "./agentLoopPendingPhaseResolve.js";

describe("agentLoopPendingPhaseResolve", () => {
    it("returns null when no pending phase exists", () => {
        const records: AgentHistoryRecord[] = [{ type: "note", at: 1, text: "noop" }];
        expect(agentLoopPendingPhaseResolve(records)).toBeNull();
    });

    it("returns vm_start phase when assistant message has run_python tool calls without rlm_start", () => {
        const records: AgentHistoryRecord[] = [
            {
                type: "assistant_message",
                at: 10,
                tokens: null,
                content: [{ type: "toolCall", id: "tool-1", name: "run_python", arguments: { code: "echo('x')" } }]
            }
        ];

        const pending = agentLoopPendingPhaseResolve(records);

        expect(pending).not.toBeNull();
        expect(pending?.type).toBe("vm_start");
        if (pending?.type === "vm_start") {
            expect(pending.blocks).toEqual(["echo('x')"]);
            expect(pending.blockToolCallIds).toEqual(["tool-1"]);
            expect(pending.blockIndex).toBe(0);
            expect(pending.assistantAt).toBe(10);
        }
    });

    it("returns tool_call phase for pending rlm execution with snapshot", () => {
        const records: AgentHistoryRecord[] = [
            {
                type: "assistant_message",
                at: 5,
                tokens: null,
                content: [
                    { type: "toolCall", id: "tool-1", name: "run_python", arguments: { code: "echo('a')" } },
                    { type: "toolCall", id: "tool-2", name: "run_python", arguments: { code: "echo('b')" } }
                ]
            },
            {
                type: "rlm_start",
                at: 6,
                toolCallId: "tool-2",
                code: "echo('b')",
                preamble: "..."
            },
            {
                type: "rlm_tool_call",
                at: 7,
                toolCallId: "tool-2",
                snapshotId: "snapshot-id",
                printOutput: [],
                toolCallCount: 0,
                toolName: "echo",
                toolArgs: { text: "b" }
            }
        ];

        const pending = agentLoopPendingPhaseResolve(records);

        expect(pending).not.toBeNull();
        expect(pending?.type).toBe("tool_call");
        if (pending?.type === "tool_call") {
            expect(pending.start.toolCallId).toBe("tool-2");
            expect(pending.snapshot.snapshotId).toBe("snapshot-id");
            expect(pending.blockIndex).toBe(1);
            expect(pending.blocks).toEqual(["echo('a')", "echo('b')"]);
            expect(pending.blockToolCallIds).toEqual(["tool-1", "tool-2"]);
        }
    });

    it("returns error phase when pending rlm start has no snapshot", () => {
        const records: AgentHistoryRecord[] = [
            {
                type: "assistant_message",
                at: 5,
                tokens: null,
                content: [{ type: "toolCall", id: "tool-1", name: "run_python", arguments: { code: "echo('a')" } }]
            },
            {
                type: "rlm_start",
                at: 6,
                toolCallId: "tool-1",
                code: "echo('a')",
                preamble: "..."
            }
        ];

        const pending = agentLoopPendingPhaseResolve(records);

        expect(pending).not.toBeNull();
        expect(pending?.type).toBe("error");
        if (pending?.type === "error") {
            expect(pending.start.toolCallId).toBe("tool-1");
            expect(pending.message).toContain("before any tool call");
        }
    });
});
