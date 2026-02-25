import { describe, expect, it } from "vitest";

import type { AgentHistoryRecord } from "@/types";
import { agentLoopPendingPhaseResolve } from "./agentLoopPendingPhaseResolve.js";

describe("agentLoopPendingPhaseResolve", () => {
    it("returns null when no pending phase exists", () => {
        const records: AgentHistoryRecord[] = [{ type: "note", at: 1, text: "noop" }];
        expect(agentLoopPendingPhaseResolve(records)).toBeNull();
    });

    it("returns vm_start phase when assistant message has run_python without rlm_start", () => {
        const records: AgentHistoryRecord[] = [
            {
                type: "assistant_message",
                at: 10,
                text: "<run_python>echo('x')</run_python>",
                files: [],
                tokens: null
            }
        ];

        const pending = agentLoopPendingPhaseResolve(records);

        expect(pending).not.toBeNull();
        expect(pending?.type).toBe("vm_start");
        if (pending?.type === "vm_start") {
            expect(pending.blocks).toEqual(["echo('x')"]);
            expect(pending.blockIndex).toBe(0);
            expect(pending.assistantAt).toBe(10);
        }
    });

    it("returns tool_call phase for pending rlm execution with snapshot", () => {
        const records: AgentHistoryRecord[] = [
            {
                type: "assistant_message",
                at: 5,
                text: "<run_python>echo('a')</run_python><run_python>echo('b')</run_python>",
                files: [],
                tokens: null
            },
            {
                type: "rlm_start",
                at: 6,
                toolCallId: "run-2",
                code: "echo('b')",
                preamble: "..."
            },
            {
                type: "rlm_tool_call",
                at: 7,
                toolCallId: "run-2",
                snapshot: "snapshot",
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
            expect(pending.start.toolCallId).toBe("run-2");
            expect(pending.snapshot.snapshot).toBe("snapshot");
            expect(pending.blockIndex).toBe(1);
            expect(pending.blocks).toEqual(["echo('a')", "echo('b')"]);
        }
    });

    it("returns error phase when pending rlm start has no snapshot", () => {
        const records: AgentHistoryRecord[] = [
            {
                type: "assistant_message",
                at: 5,
                text: "<run_python>echo('a')</run_python>",
                files: [],
                tokens: null
            },
            {
                type: "rlm_start",
                at: 6,
                toolCallId: "run-1",
                code: "echo('a')",
                preamble: "..."
            }
        ];

        const pending = agentLoopPendingPhaseResolve(records);

        expect(pending).not.toBeNull();
        expect(pending?.type).toBe("error");
        if (pending?.type === "error") {
            expect(pending.start.toolCallId).toBe("run-1");
            expect(pending.message).toContain("before any tool call");
        }
    });
});
