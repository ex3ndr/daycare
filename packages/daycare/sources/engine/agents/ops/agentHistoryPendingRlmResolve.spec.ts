import { describe, expect, it } from "vitest";

import type { AgentHistoryRecord } from "@/types";
import { agentHistoryPendingRlmResolve } from "./agentHistoryPendingRlmResolve.js";

describe("agentHistoryPendingRlmResolve", () => {
    it("returns null when no RLM start record exists", () => {
        const records: AgentHistoryRecord[] = [{ type: "note", at: 1, text: "noop" }];
        expect(agentHistoryPendingRlmResolve(records)).toBeNull();
    });

    it("returns null when RLM execution is already complete", () => {
        const records: AgentHistoryRecord[] = [
            {
                type: "rlm_start",
                at: 1,
                toolCallId: "run-1",
                code: "echo('x')",
                preamble: "..."
            },
            {
                type: "rlm_complete",
                at: 2,
                toolCallId: "run-1",
                output: "x",
                printOutput: [],
                toolCallCount: 1,
                isError: false
            }
        ];
        expect(agentHistoryPendingRlmResolve(records)).toBeNull();
    });

    it("returns the latest pending start and latest snapshot", () => {
        const records: AgentHistoryRecord[] = [
            {
                type: "rlm_start",
                at: 1,
                toolCallId: "run-old",
                code: "echo('old')",
                preamble: "..."
            },
            {
                type: "rlm_tool_call",
                at: 2,
                toolCallId: "run-old",
                snapshot: "aaa",
                printOutput: [],
                toolCallCount: 0,
                toolName: "echo",
                toolArgs: { text: "old" }
            },
            {
                type: "rlm_complete",
                at: 3,
                toolCallId: "run-old",
                output: "old",
                printOutput: [],
                toolCallCount: 1,
                isError: false
            },
            {
                type: "rlm_start",
                at: 4,
                toolCallId: "run-new",
                code: "echo('new')",
                preamble: "..."
            },
            {
                type: "rlm_tool_call",
                at: 5,
                toolCallId: "run-new",
                snapshot: "bbb",
                printOutput: ["first"],
                toolCallCount: 1,
                toolName: "echo",
                toolArgs: { text: "new-1" }
            },
            {
                type: "rlm_tool_call",
                at: 6,
                toolCallId: "run-new",
                snapshot: "ccc",
                printOutput: ["first", "second"],
                toolCallCount: 2,
                toolName: "echo",
                toolArgs: { text: "new-2" }
            }
        ];

        const pending = agentHistoryPendingRlmResolve(records);

        expect(pending).not.toBeNull();
        expect(pending?.start.toolCallId).toBe("run-new");
        expect(pending?.lastSnapshot?.snapshot).toBe("ccc");
    });

    it("returns pending start with null snapshot when no tool-call snapshot exists", () => {
        const records: AgentHistoryRecord[] = [
            {
                type: "rlm_start",
                at: 10,
                toolCallId: "run-no-snapshot",
                code: "print('x')",
                preamble: "..."
            }
        ];

        const pending = agentHistoryPendingRlmResolve(records);

        expect(pending).not.toBeNull();
        expect(pending?.start.toolCallId).toBe("run-no-snapshot");
        expect(pending?.lastSnapshot).toBeNull();
    });
});
