import type { ToolCall } from "@mariozechner/pi-ai";
import { Type } from "@sinclair/typebox";
import { describe, expect, it, vi } from "vitest";

import type { AgentHistoryRecord, ToolExecutionContext, ToolExecutionResult } from "@/types";
import { montyPreambleBuild } from "../monty/montyPreambleBuild.js";
import type { ToolResolverApi } from "../toolResolver.js";
import { rlmExecute } from "./rlmExecute.js";

const baseTools = [
    {
        name: "echo",
        description: "Echo back text.",
        parameters: Type.Object({ text: Type.String() }, { additionalProperties: false })
    },
    {
        name: "fail_tool",
        description: "Always fails.",
        parameters: Type.Object({}, { additionalProperties: false })
    },
    {
        name: "skip",
        description: "Skip this turn.",
        parameters: Type.Object({}, { additionalProperties: false })
    }
];
const toolsWithoutSkip = baseTools.filter((tool) => tool.name !== "skip");

describe("rlmExecute", () => {
    it("executes a tool call and returns final output", async () => {
        const resolver = createResolver(async (name, args) => {
            if (name !== "echo") {
                throw new Error(`Unexpected tool ${name}`);
            }
            const payload = args as { text: string };
            return okResult(name, String(payload.text));
        });

        const result = await rlmExecute(
            "value = echo('hello')\nvalue",
            montyPreambleBuild(baseTools),
            createContext(),
            resolver,
            "tool-call-1"
        );

        expect(result.output).toBe('{"text":"hello"}');
        expect(result.toolCallCount).toBe(1);
        expect(result.printOutput).toEqual([]);
    });

    it("supports chained calls and catches tool errors in python", async () => {
        const resolver = createResolver(async (name, args) => {
            if (name === "echo") {
                const payload = args as { text: string };
                return okResult(name, `echo:${payload.text}`);
            }
            if (name === "fail_tool") {
                return errorResult(name, "boom");
            }
            throw new Error(`Unexpected tool ${name}`);
        });

        const code = [
            "first = echo('one')",
            "try:",
            "    fail_tool()",
            "except ToolError:",
            "    pass",
            "second = echo(first)",
            "second"
        ].join("\n");

        const result = await rlmExecute(code, montyPreambleBuild(baseTools), createContext(), resolver, "tool-call-1");

        expect(result.output).toBe('{"text":"echo:[object Object]"}');
        expect(result.toolCallCount).toBe(3);
    });

    it("captures print output", async () => {
        const resolver = createResolver(async (name) => {
            throw new Error(`Unexpected tool ${name}`);
        });

        const result = await rlmExecute(
            "print('hello', 'world')\n'done'",
            montyPreambleBuild(baseTools),
            createContext(),
            resolver,
            "tool-call-1"
        );

        expect(result.output).toBe("done");
        expect(result.printOutput).toEqual(["hello world"]);
        expect(result.toolCallCount).toBe(0);
    });

    it("exposes context.print to tools during python execution", async () => {
        const execute = vi.fn(async (toolCall: ToolCall, toolContext: ToolExecutionContext) => {
            toolContext.print?.("stdout", `tool ${toolCall.name}`);
            return okResult(toolCall.name, "ok");
        });
        const resolver: ToolResolverApi = {
            listTools: () => baseTools,
            listToolsForAgent: () => baseTools,
            execute
        };

        const result = await rlmExecute(
            "echo('hello')\n'done'",
            montyPreambleBuild(baseTools),
            createContext(),
            resolver,
            "tool-call-print-context"
        );

        expect(result.output).toBe("done");
        expect(result.printOutput).toEqual(["tool echo"]);
        expect(execute).toHaveBeenCalledTimes(1);
        const executionContext = execute.mock.calls[0]?.[1] as ToolExecutionContext;
        expect(executionContext.pythonExecution).toBe(true);
        expect(typeof executionContext.print).toBe("function");
    });

    it("routes context.print through stdout/stderr selector", async () => {
        const execute = vi.fn(async (toolCall: ToolCall, toolContext: ToolExecutionContext) => {
            toolContext.print?.("stderr", `${toolCall.name}:err`);
            toolContext.print?.("stdout", `${toolCall.name}:out`);
            return okResult(toolCall.name, "ok");
        });
        const resolver: ToolResolverApi = {
            listTools: () => baseTools,
            listToolsForAgent: () => baseTools,
            execute
        };

        const result = await rlmExecute(
            "echo('hello')\n'done'",
            montyPreambleBuild(baseTools),
            createContext(),
            resolver,
            "tool-call-print-labels"
        );

        expect(result.output).toBe("done");
        expect(result.printOutput).toEqual(["echo:out"]);
    });

    it("resumes execution after tool calls and returns final output", async () => {
        const resolver = createResolver(async (name, args) => {
            if (name !== "echo") {
                throw new Error(`Unexpected tool ${name}`);
            }
            const payload = args as { text: string };
            return okResult(name, payload.text);
        });

        const result = await rlmExecute(
            "value = echo('hello')\nvalue",
            montyPreambleBuild(baseTools),
            createContext(),
            resolver,
            "tool-call-1"
        );

        expect(result.output).toBe('{"text":"hello"}');
        expect(result.toolCallCount).toBe(1);
    });

    it("skips checkpoint record when snapshot persistence context is missing", async () => {
        const resolver = createResolver(async (name, args) => {
            if (name !== "echo") {
                throw new Error(`Unexpected tool ${name}`);
            }
            const payload = args as { text: string };
            return okResult(name, payload.text);
        });
        const records: string[] = [];

        const result = await rlmExecute(
            "value = echo('hello')\nvalue",
            montyPreambleBuild(baseTools),
            createContext(),
            resolver,
            "outer-run-python",
            async (record) => {
                records.push(record.type);
            }
        );

        expect(result.output).toBe('{"text":"hello"}');
        expect(records).toEqual(["rlm_start", "rlm_tool_result", "rlm_complete"]);
    });

    it("fails fast when checkpoint persistence fails and records tool_result", async () => {
        const resolver = createResolver(async (name, args) => {
            if (name !== "echo") {
                throw new Error(`Unexpected tool ${name}`);
            }
            const payload = args as { text: string };
            return okResult(name, payload.text);
        });
        const records: AgentHistoryRecord[] = [];

        await expect(
            rlmExecute(
                "value = echo('hello')\nvalue",
                montyPreambleBuild(baseTools),
                createContext({
                    activeSessionId: "session-1",
                    agentsDir: "/dev/null"
                }),
                resolver,
                "outer-run-python",
                async (record) => {
                    records.push(record);
                }
            )
        ).rejects.toThrow("Python VM crashed: failed to persist checkpoint");

        expect(records.map((record) => record.type)).toEqual(["rlm_start", "rlm_tool_result"]);
        const toolResult = records.find(
            (record): record is Extract<AgentHistoryRecord, { type: "rlm_tool_result" }> =>
                record.type === "rlm_tool_result"
        );
        expect(toolResult?.toolIsError).toBe(true);
        expect(toolResult?.toolResult).toContain("failed to persist checkpoint");
    });

    it("aborts execution when skip() is called and sets skipTurn flag", async () => {
        const resolver = createResolver(async (name) => {
            throw new Error(`Unexpected tool ${name}`);
        });
        const records: string[] = [];

        const result = await rlmExecute(
            "skip()\necho('should not run')",
            montyPreambleBuild(baseTools),
            createContext(),
            resolver,
            "tool-call-skip",
            async (record) => {
                records.push(record.type);
            }
        );

        expect(result.skipTurn).toBe(true);
        expect(result.output).toBe("Turn skipped");
        expect(result.toolCallCount).toBe(0);
        // Should not have executed the echo tool
        expect(resolver.execute).not.toHaveBeenCalled();
        // Should emit rlm_start and rlm_complete only (no tool_call/tool_result)
        expect(records).toEqual(["rlm_start", "rlm_complete"]);
    });

    it("supports skip() even when resolver does not advertise skip in tool listings", async () => {
        const resolver: ToolResolverApi = {
            listTools: () => toolsWithoutSkip,
            listToolsForAgent: () => toolsWithoutSkip,
            execute: vi.fn(async (toolCall) => okResult(toolCall.name, "unexpected"))
        };

        const result = await rlmExecute(
            "skip()\n'after'",
            montyPreambleBuild(toolsWithoutSkip),
            createContext(),
            resolver,
            "tool-call-skip-missing"
        );

        expect(result.skipTurn).toBe(true);
        expect(result.output).toBe("Turn skipped");
        expect(resolver.execute).not.toHaveBeenCalled();
    });

    it("supports json_parse/json_stringify runtime operations with optional pretty output", async () => {
        const resolver = createResolver(async (name) => {
            throw new Error(`Unexpected tool ${name}`);
        });

        const result = await rlmExecute(
            [
                'parsed = json_parse(\'{"alpha":1,"rows":[{"id":"a"}]}\')["value"]',
                'json_stringify(parsed, pretty=True)["value"]'
            ].join("\n"),
            montyPreambleBuild(baseTools),
            createContext(),
            resolver,
            "tool-call-json-helpers"
        );

        expect(result.output).toBe('{\n  "alpha": 1,\n  "rows": [\n    {\n      "id": "a"\n    }\n  ]\n}');
        expect(result.toolCallCount).toBe(2);
        expect(resolver.execute).not.toHaveBeenCalled();
    });

    it("fails fast when python calls an undefined function", async () => {
        const resolver = createResolver(async (name) => {
            throw new Error(`Unexpected tool ${name}`);
        });

        await expect(
            rlmExecute("not_existing()", montyPreambleBuild(baseTools), createContext(), resolver, "tool-call-typing")
        ).rejects.toThrow("unresolved-reference");

        expect(resolver.execute).not.toHaveBeenCalled();
    });

    it("fails fast when Monty type checking finds invalid tool argument types", async () => {
        const resolver = createResolver(async (name) => {
            throw new Error(`Unexpected tool ${name}`);
        });

        await expect(
            rlmExecute("echo(1)", montyPreambleBuild(baseTools), createContext(), resolver, "tool-call-typing")
        ).rejects.toThrow("Python type check failed.");
    });
});

function createResolver(handler: (name: string, args: unknown) => Promise<ToolExecutionResult>): ToolResolverApi {
    return {
        listTools: () => baseTools,
        listToolsForAgent: () => baseTools,
        execute: vi.fn(async (toolCall) => handler(toolCall.name, toolCall.arguments))
    };
}

function createContext(options?: { activeSessionId?: string | null; agentsDir?: string }): ToolExecutionContext {
    const activeSessionId = options?.activeSessionId ?? null;
    return {
        connectorRegistry: null as unknown as ToolExecutionContext["connectorRegistry"],
        sandbox: null as unknown as ToolExecutionContext["sandbox"],
        auth: null as unknown as ToolExecutionContext["auth"],
        logger: console as unknown as ToolExecutionContext["logger"],
        assistant: null,
        agent: activeSessionId
            ? ({ state: { activeSessionId } } as unknown as ToolExecutionContext["agent"])
            : (null as unknown as ToolExecutionContext["agent"]),
        ctx: { userId: "user-1", agentId: "agent-1" } as ToolExecutionContext["ctx"],
        source: "test",
        messageContext: {},
        agentSystem: {
            config: {
                current: {
                    agentsDir: options?.agentsDir ?? "/tmp/daycare-test",
                    path: ":memory:"
                }
            },
            storage: {}
        } as unknown as ToolExecutionContext["agentSystem"]
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
