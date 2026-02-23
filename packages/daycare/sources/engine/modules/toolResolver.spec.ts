import { Type } from "@sinclair/typebox";
import { describe, expect, it } from "vitest";

import type { ToolExecutionContext, ToolExecutionResult, ToolVisibilityContext } from "@/types";
import { contextForAgent } from "../agents/context.js";
import { ToolResolver } from "./toolResolver.js";

const textResultSchema = Type.Object({ text: Type.String() }, { additionalProperties: false });
const textReturns = {
    schema: textResultSchema,
    toLLMText: (result: { text: string }) => result.text
};

describe("ToolResolver", () => {
    it("lists tools as visible by default when callback is not defined", () => {
        const resolver = new ToolResolver();
        resolver.register("test", {
            tool: {
                name: "read_file",
                description: "Read file.",
                parameters: Type.Object({ path: Type.String() }, { additionalProperties: false })
            },
            returns: textReturns,
            execute: async () => okResult("read_file", "ok")
        });

        const tools = resolver.listToolsForAgent(toolVisibilityContextCreate());

        expect(tools.map((tool) => tool.name)).toEqual(["read_file"]);
    });

    it("omits tools from contextual list when visibleByDefault returns false", () => {
        const resolver = new ToolResolver();
        resolver.register("test", {
            tool: {
                name: "read_file",
                description: "Read file.",
                parameters: Type.Object({ path: Type.String() }, { additionalProperties: false })
            },
            returns: textReturns,
            visibleByDefault: () => false,
            execute: async () => okResult("read_file", "ok")
        });

        const tools = resolver.listToolsForAgent(toolVisibilityContextCreate());

        expect(tools).toEqual([]);
    });

    it("supports descriptor-aware visibility callbacks", () => {
        const resolver = new ToolResolver();
        resolver.register("test", {
            tool: {
                name: "memory_node_read",
                description: "Read memory node.",
                parameters: Type.Object({}, { additionalProperties: false })
            },
            returns: textReturns,
            visibleByDefault: (context) => context.descriptor.type === "memory-agent",
            execute: async () => okResult("memory_node_read", "ok")
        });

        const memoryTools = resolver.listToolsForAgent(
            toolVisibilityContextCreate({ descriptor: { type: "memory-agent", id: "agent-1" } })
        );
        const userTools = resolver.listToolsForAgent(toolVisibilityContextCreate());

        expect(memoryTools.map((tool) => tool.name)).toEqual(["memory_node_read"]);
        expect(userTools).toEqual([]);
    });

    it("keeps hidden tools executable when no execution allowlist is configured", async () => {
        const resolver = new ToolResolver();
        resolver.register("test", {
            tool: {
                name: "hidden_tool",
                description: "Hidden tool.",
                parameters: Type.Object({}, { additionalProperties: false })
            },
            returns: textReturns,
            visibleByDefault: () => false,
            execute: async () => okResult("hidden_tool", "ok")
        });

        expect(resolver.listToolsForAgent(toolVisibilityContextCreate())).toEqual([]);

        const result = await resolver.execute(
            {
                type: "toolCall",
                id: "call-1",
                name: "hidden_tool",
                arguments: {}
            },
            toolExecutionContextCreate()
        );

        expect(result.toolMessage.isError).toBe(false);
        expect(messageText(result)).toContain("ok");
    });

    it("blocks execution when tool is not in execution allowlist", async () => {
        const resolver = new ToolResolver();
        resolver.register("test", {
            tool: {
                name: "read_file",
                description: "Read file.",
                parameters: Type.Object({ path: Type.String() }, { additionalProperties: false })
            },
            returns: textReturns,
            execute: async () => okResult("read_file", "ok")
        });

        const result = await resolver.execute(
            {
                type: "toolCall",
                id: "call-1",
                name: "read_file",
                arguments: { path: "/tmp/a.txt" }
            },
            toolExecutionContextCreate({ allowedToolNames: new Set(["memory_node_read"]) })
        );

        expect(result.toolMessage.isError).toBe(true);
        expect(messageText(result)).toContain('Tool "read_file" is not allowed for this agent.');
    });

    it("rejects non-run_python tool calls when rlmToolOnly is enabled", async () => {
        const resolver = new ToolResolver();
        resolver.register("test", {
            tool: {
                name: "read_file",
                description: "Read file.",
                parameters: Type.Object({ path: Type.String() }, { additionalProperties: false })
            },
            returns: textReturns,
            execute: async () => okResult("read_file", "ok")
        });

        const result = await resolver.execute(
            {
                type: "toolCall",
                id: "call-1",
                name: "read_file",
                arguments: { path: "/tmp/a.txt" }
            },
            toolExecutionContextCreate({ rlmToolOnly: true })
        );

        expect(result.toolMessage.isError).toBe(true);
        expect(messageText(result)).toContain('RLM mode only allows calling "run_python" or "skip".');
    });

    it("allows skip tool calls when rlmToolOnly is enabled", async () => {
        const resolver = new ToolResolver();
        resolver.register("test", {
            tool: {
                name: "skip",
                description: "Skip turn.",
                parameters: Type.Object({}, { additionalProperties: false })
            },
            returns: textReturns,
            execute: async () => okResult("skip", "skipped")
        });

        const result = await resolver.execute(
            {
                type: "toolCall",
                id: "call-1",
                name: "skip",
                arguments: {}
            },
            toolExecutionContextCreate({ rlmToolOnly: true })
        );

        expect(result.toolMessage.isError).toBe(false);
        expect(messageText(result)).toContain("skipped");
    });

    it("allows run_python tool calls when rlmToolOnly is enabled", async () => {
        const resolver = new ToolResolver();
        resolver.register("test", {
            tool: {
                name: "run_python",
                description: "Run python.",
                parameters: Type.Object({ code: Type.String() }, { additionalProperties: false })
            },
            returns: textReturns,
            execute: async () => okResult("run_python", "ok")
        });

        const result = await resolver.execute(
            {
                type: "toolCall",
                id: "call-1",
                name: "run_python",
                arguments: { code: "print(1)" }
            },
            toolExecutionContextCreate({ rlmToolOnly: true })
        );

        expect(result.toolMessage.isError).toBe(false);
        expect(messageText(result)).toContain("ok");
    });

    it("allows non-run_python tool calls when rlmToolOnly is disabled", async () => {
        const resolver = new ToolResolver();
        resolver.register("test", {
            tool: {
                name: "read_file",
                description: "Read file.",
                parameters: Type.Object({ path: Type.String() }, { additionalProperties: false })
            },
            returns: textReturns,
            execute: async () => okResult("read_file", "ok")
        });

        const result = await resolver.execute(
            {
                type: "toolCall",
                id: "call-1",
                name: "read_file",
                arguments: { path: "/tmp/a.txt" }
            },
            toolExecutionContextCreate({ rlmToolOnly: false })
        );

        expect(result.toolMessage.isError).toBe(false);
        expect(messageText(result)).toContain("ok");
    });

    it("keeps typed results from tool executions", async () => {
        const resolver = new ToolResolver();
        resolver.register("test", {
            tool: {
                name: "read_file",
                description: "Read file.",
                parameters: Type.Object({ path: Type.String() }, { additionalProperties: false })
            },
            returns: textReturns,
            execute: async () => ({
                toolMessage: {
                    role: "toolResult",
                    toolCallId: "tool-call-1",
                    toolName: "read_file",
                    content: [{ type: "text", text: "ok" }],
                    details: { path: "/tmp/a.txt", found: true },
                    isError: false,
                    timestamp: Date.now()
                },
                typedResult: { text: "ok" }
            })
        });

        const result = await resolver.execute(
            {
                type: "toolCall",
                id: "call-1",
                name: "read_file",
                arguments: { path: "/tmp/a.txt" }
            },
            toolExecutionContextCreate({ rlmToolOnly: false })
        );

        expect(result.typedResult).toEqual({ text: "ok" });
    });

    it("uses returns.toLLMText when tool response contains no text block", async () => {
        const resolver = new ToolResolver();
        resolver.register("test", {
            tool: {
                name: "count_rows",
                description: "Counts rows.",
                parameters: Type.Object({}, { additionalProperties: false })
            },
            returns: {
                schema: Type.Object({ text: Type.String() }, { additionalProperties: false }),
                toLLMText: () => "Rows: 3"
            },
            execute: async () => ({
                toolMessage: {
                    role: "toolResult",
                    toolCallId: "tool-call-1",
                    toolName: "count_rows",
                    content: [],
                    isError: false,
                    timestamp: Date.now()
                },
                typedResult: { text: "" }
            })
        });

        const result = await resolver.execute(
            {
                type: "toolCall",
                id: "call-2",
                name: "count_rows",
                arguments: {}
            },
            toolExecutionContextCreate()
        );

        expect(messageText(result)).toContain("Rows: 3");
        expect(result.typedResult).toEqual({ text: "" });
    });

    it("rejects tool output that does not match declared return schema", async () => {
        const resolver = new ToolResolver();
        resolver.register("test", {
            tool: {
                name: "count_rows",
                description: "Counts rows.",
                parameters: Type.Object({}, { additionalProperties: false })
            },
            returns: {
                schema: Type.Object({ text: Type.String() }, { additionalProperties: false }),
                toLLMText: () => "Rows: 3"
            },
            execute: async () => ({
                toolMessage: {
                    role: "toolResult",
                    toolCallId: "tool-call-1",
                    toolName: "count_rows",
                    content: [{ type: "text", text: "n/a" }],
                    isError: false,
                    timestamp: Date.now()
                },
                typedResult: { text: 123 as unknown as string }
            })
        });

        const result = await resolver.execute(
            {
                type: "toolCall",
                id: "call-2",
                name: "count_rows",
                arguments: {}
            },
            toolExecutionContextCreate()
        );

        expect(result.toolMessage.isError).toBe(true);
        expect(messageText(result)).toContain("does not match its return schema");
    });
});

function toolExecutionContextCreate(overrides: Partial<ToolExecutionContext> = {}): ToolExecutionContext {
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
        heartbeats: null as unknown as ToolExecutionContext["heartbeats"],
        ...overrides
    };
}

function toolVisibilityContextCreate(overrides: Partial<ToolVisibilityContext> = {}): ToolVisibilityContext {
    return {
        ctx: contextForAgent({ userId: "user-1", agentId: "agent-1" }),
        descriptor: {
            type: "user",
            connector: "telegram",
            userId: "user-1",
            channelId: "channel-1"
        },
        ...overrides
    };
}

function okResult(name: string, text: string): ToolExecutionResult {
    return {
        toolMessage: {
            role: "toolResult",
            toolCallId: "tool-call-1",
            toolName: name,
            content: [{ type: "text", text }],
            isError: false,
            timestamp: Date.now()
        },
        typedResult: { text }
    };
}

function messageText(result: ToolExecutionResult): string {
    return result.toolMessage.content
        .filter((entry) => entry.type === "text")
        .map((entry) => ("text" in entry && typeof entry.text === "string" ? entry.text : ""))
        .join("\n");
}
