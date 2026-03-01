import type { Tool } from "@mariozechner/pi-ai";
import { Type } from "@sinclair/typebox";
import { describe, expect, it, vi } from "vitest";

import type { ToolExecutionContext, ToolExecutionResult } from "@/types";
import { montyPreambleBuild } from "../monty/montyPreambleBuild.js";
import type { ToolResolverApi } from "../toolResolver.js";
import { RLM_LIMITS } from "./rlmLimits.js";
import { rlmStepStart } from "./rlmStepStart.js";
import { rlmStepToolCall } from "./rlmStepToolCall.js";

const tools: Tool[] = [
    {
        name: "echo",
        description: "Echo",
        parameters: Type.Object({ text: Type.String() }, { additionalProperties: false })
    }
];

describe("rlmStepToolCall", () => {
    it("executes one tool call and returns resume returnValue", async () => {
        const resolver = resolverBuild(async (_name, args) => {
            const payload = args as { text: string };
            return okResult("echo", payload.text);
        });
        const step = await startSnapshotBuild("echo('hello')");
        const beforeExecute = vi.fn(async () => undefined);

        const result = await rlmStepToolCall({
            snapshot: step,
            toolByName: new Map(tools.map((tool) => [tool.name, tool])),
            toolResolver: resolver,
            context: contextBuild(),
            beforeExecute
        });

        expect(result.toolName).toBe("echo");
        expect(result.toolArgs).toEqual({ text: "hello" });
        expect(result.toolIsError).toBe(false);
        expect(result.resumeOptions).toEqual({ returnValue: { text: "hello" } });
        expect(beforeExecute).toHaveBeenCalledTimes(1);
    });

    it("returns exception resume options for tool errors", async () => {
        const resolver = resolverBuild(async (_name, _args) => errorResult("echo", "boom"));
        const step = await startSnapshotBuild("echo('hello')");

        const result = await rlmStepToolCall({
            snapshot: step,
            toolByName: new Map(tools.map((tool) => [tool.name, tool])),
            toolResolver: resolver,
            context: contextBuild()
        });

        expect(result.toolIsError).toBe(true);
        expect("exception" in result.resumeOptions).toBe(true);
        if ("exception" in result.resumeOptions) {
            expect(result.resumeOptions.exception.message).toContain("boom");
        }
    });

    it("converts beforeExecute failures into tool errors", async () => {
        const execute = vi.fn(async (name: string, args: unknown) => okResult(name, JSON.stringify(args)));
        const resolver = resolverBuild(execute);
        const step = await startSnapshotBuild("echo('hello')");

        const result = await rlmStepToolCall({
            snapshot: step,
            toolByName: new Map(tools.map((tool) => [tool.name, tool])),
            toolResolver: resolver,
            context: contextBuild(),
            beforeExecute: async () => {
                throw new Error("checkpoint write failed");
            }
        });

        expect(execute).not.toHaveBeenCalled();
        expect(result.toolIsError).toBe(true);
        expect(result.toolResult).toContain("checkpoint write failed");
        expect("exception" in result.resumeOptions).toBe(true);
        if ("exception" in result.resumeOptions) {
            expect(result.resumeOptions.exception.message).toContain("checkpoint write failed");
        }
    });

    it("rethrows AbortError instead of converting it into tool error output", async () => {
        const abortController = new AbortController();
        const resolver = resolverBuild(async () => {
            throw abortErrorBuild();
        });
        const step = await startSnapshotBuild("echo('hello')");

        await expect(
            rlmStepToolCall({
                snapshot: step,
                toolByName: new Map(tools.map((tool) => [tool.name, tool])),
                toolResolver: resolver,
                context: contextBuild(abortController.signal)
            })
        ).rejects.toMatchObject({ name: "AbortError" });
    });
});

async function startSnapshotBuild(code: string) {
    const started = await rlmStepStart({
        workerKey: "test:agent",
        code,
        preamble: montyPreambleBuild(tools),
        externalFunctions: ["echo"],
        limits: RLM_LIMITS,
        printCallback: () => undefined
    });
    if (!("functionName" in started.progress)) {
        throw new Error("Expected Monty to pause at a tool call.");
    }
    return started.progress;
}

function resolverBuild(handler: (name: string, args: unknown) => Promise<ToolExecutionResult>): ToolResolverApi {
    return {
        listTools: () => tools,
        listToolsForAgent: () => tools,
        execute: vi.fn(async (toolCall) => handler(toolCall.name, toolCall.arguments)),
        deferredHandlerFor: () => undefined
    };
}

function contextBuild(abortSignal?: AbortSignal): ToolExecutionContext {
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
        abortSignal,
        agentSystem: null as unknown as ToolExecutionContext["agentSystem"]
    };
}

function abortErrorBuild(): Error {
    const error = new Error("Operation aborted.");
    error.name = "AbortError";
    return error;
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

function errorResult(name: string, text: string): ToolExecutionResult {
    return {
        toolMessage: {
            role: "toolResult",
            toolCallId: "1",
            toolName: name,
            content: [{ type: "text", text }],
            isError: true,
            timestamp: Date.now()
        },
        typedResult: { text }
    };
}
