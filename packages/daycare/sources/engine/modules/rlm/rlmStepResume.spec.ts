import type { Tool } from "@mariozechner/pi-ai";
import { Type } from "@sinclair/typebox";
import { describe, expect, it, vi } from "vitest";

import type { ToolExecutionContext, ToolExecutionResult } from "@/types";
import { montyPreambleBuild } from "../monty/montyPreambleBuild.js";
import type { ToolResolverApi } from "../toolResolver.js";
import { RLM_LIMITS } from "./rlmLimits.js";
import { rlmStepResume } from "./rlmStepResume.js";
import { rlmStepStart } from "./rlmStepStart.js";
import { rlmStepToolCall } from "./rlmStepToolCall.js";
import { rlmValueFormat } from "./rlmValueFormat.js";

const tools: Tool[] = [
    {
        name: "echo",
        description: "Echo",
        parameters: Type.Object({ text: Type.String() }, { additionalProperties: false })
    }
];

describe("rlmStepResume", () => {
    it("resumes snapshot execution and completes script output", async () => {
        const resolver = resolverBuild(async (_name, args) => {
            const payload = args as { text: string };
            return okResult("echo", payload.text);
        });
        const started = rlmStepStart({
            code: "value = echo('hello')\nvalue",
            preamble: montyPreambleBuild(tools),
            externalFunctions: ["echo"],
            limits: RLM_LIMITS,
            printCallback: () => undefined
        });
        if (!("functionName" in started.progress)) {
            throw new Error("Expected Monty to pause at a tool call.");
        }

        const callResult = await rlmStepToolCall({
            snapshot: started.progress,
            toolByName: new Map(tools.map((tool) => [tool.name, tool])),
            toolResolver: resolver,
            context: contextBuild()
        });
        const resumed = rlmStepResume(callResult.snapshotDump, callResult.resumeOptions, () => undefined);

        expect("output" in resumed).toBe(true);
        if ("output" in resumed) {
            expect(rlmValueFormat(resumed.output)).toBe('{"text":"hello"}');
        }
    });
});

function resolverBuild(handler: (name: string, args: unknown) => Promise<ToolExecutionResult>): ToolResolverApi {
    return {
        listTools: () => tools,
        listToolsForAgent: () => tools,
        execute: vi.fn(async (toolCall) => handler(toolCall.name, toolCall.arguments))
    };
}

function contextBuild(): ToolExecutionContext {
    return {
        connectorRegistry: null as unknown as ToolExecutionContext["connectorRegistry"],
        sandbox: null as unknown as ToolExecutionContext["sandbox"],
        auth: null as unknown as ToolExecutionContext["auth"],
        logger: console as unknown as ToolExecutionContext["logger"],
        assistant: null,
        agent: null as unknown as ToolExecutionContext["agent"],
        ctx: null as unknown as ToolExecutionContext["ctx"],
        source: "test",
        messageContext: {},
        agentSystem: null as unknown as ToolExecutionContext["agentSystem"],
        heartbeats: null as unknown as ToolExecutionContext["heartbeats"]
    };
}

function okResult(name: string, text: string): ToolExecutionResult {
    return {
        toolMessage: {
            role: "toolResult",
            toolCallId: "1",
            toolName: name,
            content: [{ type: "text", text }],
            isError: false,
            timestamp: Date.now()
        },
        typedResult: { text }
    };
}
