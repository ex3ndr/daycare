import { describe, expect, it } from "vitest";

import type { EvalTrace } from "./evalRun.js";
import { evalTraceRender } from "./evalTraceRender.js";

describe("evalTraceRender", () => {
    it("renders all supported history record types", () => {
        const markdown = evalTraceRender(evalTraceFixtureBuild());

        expect(markdown).toContain("# Eval Trace: render-test");
        expect(markdown).toContain("### User");
        expect(markdown).toContain("### Assistant");
        expect(markdown).toContain('> Tool Call: start_background_agent({"prompt":"Investigate"})');
        expect(markdown).toContain("#### Assistant Rewrite");
        expect(markdown).toContain("#### Code Execution");
        expect(markdown).toContain('> Tool: run_python({"code":"print(\'hi\')"})');
        expect(markdown).toContain("> Result: execution ok");
        expect(markdown).toContain("> Output: final output");
        expect(markdown).toContain("> Note: trace note");
        expect(markdown).toContain("agent.created=1");
    });

    it("handles empty history and truncates long tool results", () => {
        const empty = evalTraceRender({
            ...evalTraceFixtureBuild(),
            history: [],
            events: []
        });
        const longToolResult = evalTraceRender({
            ...evalTraceFixtureBuild(),
            history: [
                {
                    type: "rlm_tool_result",
                    at: 1,
                    toolCallId: "tool-1",
                    toolName: "run_python",
                    toolResult: "x".repeat(2_000),
                    toolIsError: false
                }
            ]
        });

        expect(empty).toContain("_No history recorded._");
        expect(empty).toContain("_No events captured._");
        expect(longToolResult).toContain("chars truncated from tool result");
    });
});

function evalTraceFixtureBuild(): EvalTrace {
    return {
        scenario: {
            name: "render-test",
            agent: {
                kind: "agent",
                path: "eval-agent"
            },
            turns: [{ role: "user", text: "hello" }]
        },
        agentId: "agent-1",
        agentPath: "/owner/agent/eval-agent",
        startedAt: 1000,
        endedAt: 2500,
        setup: {
            result: { type: "reset", ok: true },
            durationMs: 25
        },
        turnResults: [
            {
                turn: { role: "user", text: "hello" },
                result: { type: "message", responseText: "hi" },
                durationMs: 200,
                history: []
            }
        ],
        history: [
            {
                type: "user_message",
                at: 1100,
                text: "hello",
                files: []
            },
            {
                type: "assistant_message",
                at: 1200,
                content: [
                    { type: "text", text: "hi there" },
                    {
                        type: "toolCall",
                        id: "tool-2",
                        name: "start_background_agent",
                        arguments: { prompt: "Investigate" }
                    }
                ],
                tokens: {
                    provider: "openai",
                    model: "gpt-4.1",
                    size: {
                        input: 10,
                        output: 5,
                        cacheRead: 0,
                        cacheWrite: 0,
                        total: 15
                    }
                }
            },
            {
                type: "assistant_rewrite",
                at: 1250,
                assistantAt: 1200,
                text: "trimmed assistant text",
                reason: "run_python_failure_trim"
            },
            {
                type: "rlm_start",
                at: 1300,
                toolCallId: "tool-1",
                code: "print('hi')",
                preamble: "running code"
            },
            {
                type: "rlm_tool_call",
                at: 1400,
                toolCallId: "tool-1",
                snapshotId: "snap-1",
                printOutput: [],
                toolCallCount: 1,
                toolName: "run_python",
                toolArgs: {
                    code: "print('hi')"
                }
            },
            {
                type: "rlm_tool_result",
                at: 1500,
                toolCallId: "tool-1",
                toolName: "run_python",
                toolResult: "execution ok",
                toolIsError: false
            },
            {
                type: "rlm_complete",
                at: 1600,
                toolCallId: "tool-1",
                output: "final output",
                printOutput: [],
                toolCallCount: 1,
                isError: false
            },
            {
                type: "note",
                at: 1700,
                text: "trace note"
            }
        ],
        events: [
            {
                type: "agent.created",
                payload: {
                    agentId: "agent-1"
                },
                timestamp: "2026-03-13T10:00:00.000Z"
            },
            {
                type: "agent.sync.updated",
                payload: {
                    agentId: "agent-1"
                },
                timestamp: "2026-03-13T10:00:01.000Z"
            }
        ]
    };
}
