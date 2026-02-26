import { Type } from "@sinclair/typebox";
import { describe, expect, it, vi } from "vitest";
import type { ToolExecutionContext } from "@/types";
import { runPythonTool } from "./runPythonTool.js";

const mocks = vi.hoisted(() => ({
    rlmExecute: vi.fn()
}));

vi.mock("../rlm/rlmExecute.js", () => ({
    rlmExecute: mocks.rlmExecute
}));

describe("runPythonTool", () => {
    it("executes code and returns tool-result summary", async () => {
        mocks.rlmExecute.mockResolvedValue({
            output: "done",
            printOutput: [],
            toolCallCount: 0
        });
        const tool = runPythonTool();

        const result = await tool.execute({ code: "'done'" }, contextBuild(), {
            id: "tool-call-1",
            name: "run_python"
        });

        expect(mocks.rlmExecute).toHaveBeenCalledWith(
            "'done'",
            expect.any(String),
            expect.objectContaining({ pythonExecution: true }),
            expect.any(Object),
            "tool-call-1",
            expect.any(Function),
            expect.any(Function)
        );
        expect(result.toolMessage.isError).toBe(false);
        expect(result.toolMessage.toolCallId).toBe("tool-call-1");
        expect(result.toolMessage.content[0]?.type).toBe("text");
    });

    it("marks skip results so the outer loop can stop the turn", async () => {
        mocks.rlmExecute.mockResolvedValue({
            output: "Turn skipped",
            printOutput: [],
            toolCallCount: 0,
            skipTurn: true
        });
        const tool = runPythonTool();

        const result = await tool.execute({ code: "skip()" }, contextBuild(), {
            id: "tool-call-2",
            name: "run_python"
        });

        expect(result.skipTurn).toBe(true);
    });
});

function contextBuild(): ToolExecutionContext {
    return {
        connectorRegistry: null as unknown as ToolExecutionContext["connectorRegistry"],
        sandbox: {} as unknown as ToolExecutionContext["sandbox"],
        auth: null as unknown as ToolExecutionContext["auth"],
        logger: console as unknown as ToolExecutionContext["logger"],
        assistant: null,
        agent: {
            descriptor: { type: "user", connector: "telegram", channelId: "channel-1", userId: "user-1" },
            inbox: {
                consumeSteering: () => null
            }
        } as unknown as ToolExecutionContext["agent"],
        ctx: { userId: "user-1", agentId: "agent-1" },
        source: "test",
        messageContext: {} as ToolExecutionContext["messageContext"],
        agentSystem: {} as ToolExecutionContext["agentSystem"],
        heartbeats: {} as ToolExecutionContext["heartbeats"],
        memory: {} as ToolExecutionContext["memory"],
        toolResolver: {
            listTools: () => [],
            listToolsForAgent: () => [
                { name: "run_python", description: "", parameters: Type.Object({}, { additionalProperties: false }) }
            ],
            execute: vi.fn()
        },
        appendHistoryRecord: async () => undefined
    };
}
