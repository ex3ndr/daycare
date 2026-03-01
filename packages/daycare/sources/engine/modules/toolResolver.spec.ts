import { Type } from "@sinclair/typebox";
import { describe, expect, it, vi } from "vitest";

import type { ToolExecutionContext, ToolExecutionResult, ToolVisibilityContext } from "@/types";
import { contextForAgent } from "../agents/context.js";
import { ToolResolver } from "./toolResolver.js";

const textResultSchema = Type.Object({ text: Type.String() }, { additionalProperties: false });
const textReturns = {
    schema: textResultSchema,
    toLLMText: (result: { text: string }) => result.text
};

describe("ToolResolver", () => {
    it("accepts read_json-style return schemas with Type.Any payloads", () => {
        const resolver = new ToolResolver();

        expect(() =>
            resolver.register("test", {
                tool: {
                    name: "read_json",
                    description: "Read JSON.",
                    parameters: Type.Object({ path: Type.String() }, { additionalProperties: false })
                },
                returns: {
                    schema: Type.Object(
                        {
                            summary: Type.String(),
                            value: Type.Any()
                        },
                        { additionalProperties: false }
                    ),
                    toLLMText: () => "ok"
                },
                execute: async () => ({
                    toolMessage: {
                        role: "toolResult",
                        toolCallId: "tool-call-1",
                        toolName: "read_json",
                        content: [{ type: "text", text: "ok" }],
                        isError: false,
                        timestamp: Date.now()
                    },
                    typedResult: {
                        summary: "ok",
                        value: {
                            nested: { count: 1 },
                            rows: [{ id: "x" }]
                        }
                    }
                })
            })
        ).not.toThrow();
    });

    it("rejects unrestricted additionalProperties in return schemas", () => {
        const resolver = new ToolResolver();

        expect(() =>
            resolver.register("test", {
                tool: {
                    name: "bad_schema",
                    description: "Bad schema tool.",
                    parameters: Type.Object({}, { additionalProperties: false })
                },
                returns: {
                    schema: Type.Object({}, { additionalProperties: true }),
                    toLLMText: () => "ok"
                },
                execute: async () => okResult("bad_schema", "ok")
            })
        ).toThrow(
            'Tool "bad_schema" return schema supports primitives, any, nested objects, arrays, and unions only; additionalProperties must not be true.'
        );
    });

    it("accepts nested object return properties", () => {
        const resolver = new ToolResolver();

        expect(() =>
            resolver.register("test", {
                tool: {
                    name: "not_shallow",
                    description: "Non-shallow schema tool.",
                    parameters: Type.Object({}, { additionalProperties: false })
                },
                returns: {
                    schema: Type.Object(
                        {
                            nested: Type.Object(
                                {
                                    count: Type.Number()
                                },
                                { additionalProperties: false }
                            )
                        },
                        { additionalProperties: false }
                    ),
                    toLLMText: () => "ok"
                },
                execute: async () => okResult("not_shallow", "ok")
            })
        ).not.toThrow();
    });

    it("accepts primitive union return properties", () => {
        const resolver = new ToolResolver();

        expect(() =>
            resolver.register("test", {
                tool: {
                    name: "union_ok",
                    description: "Union schema tool.",
                    parameters: Type.Object({}, { additionalProperties: false })
                },
                returns: {
                    schema: Type.Object(
                        {
                            format: Type.Union([Type.Literal("markdown"), Type.Literal("json")])
                        },
                        { additionalProperties: false }
                    ),
                    toLLMText: () => "ok"
                },
                execute: async () => okResult("union_ok", "ok")
            })
        ).not.toThrow();
    });

    it("accepts union return properties with object variants", () => {
        const resolver = new ToolResolver();

        expect(() =>
            resolver.register("test", {
                tool: {
                    name: "union_bad",
                    description: "Invalid union schema tool.",
                    parameters: Type.Object({}, { additionalProperties: false })
                },
                returns: {
                    schema: Type.Object(
                        {
                            payload: Type.Union([
                                Type.Literal("ok"),
                                Type.Object({ nested: Type.Number() }, { additionalProperties: false })
                            ])
                        },
                        { additionalProperties: false }
                    ),
                    toLLMText: () => "ok"
                },
                execute: async () => okResult("union_bad", "ok")
            })
        ).not.toThrow();
    });

    it("accepts array of primitive return properties", () => {
        const resolver = new ToolResolver();

        expect(() =>
            resolver.register("test", {
                tool: {
                    name: "primitive_array",
                    description: "Primitive array schema tool.",
                    parameters: Type.Object({}, { additionalProperties: false })
                },
                returns: {
                    schema: Type.Object(
                        {
                            tags: Type.Array(Type.String())
                        },
                        { additionalProperties: false }
                    ),
                    toLLMText: () => "ok"
                },
                execute: async () => okResult("primitive_array", "ok")
            })
        ).not.toThrow();
    });

    it("accepts deeply nested return schemas", () => {
        const resolver = new ToolResolver();

        expect(() =>
            resolver.register("test", {
                tool: {
                    name: "deep_nested",
                    description: "Deeply nested schema tool.",
                    parameters: Type.Object({}, { additionalProperties: false })
                },
                returns: {
                    schema: Type.Object(
                        {
                            meta: Type.Object(
                                {
                                    levels: Type.Array(
                                        Type.Object(
                                            {
                                                name: Type.String(),
                                                stats: Type.Object(
                                                    {
                                                        score: Type.Number(),
                                                        flags: Type.Array(Type.Union([Type.String(), Type.Null()]))
                                                    },
                                                    { additionalProperties: false }
                                                )
                                            },
                                            { additionalProperties: false }
                                        )
                                    )
                                },
                                { additionalProperties: false }
                            )
                        },
                        { additionalProperties: false }
                    ),
                    toLLMText: () => "ok"
                },
                execute: async () => okResult("deep_nested", "ok")
            })
        ).not.toThrow();
    });

    it("rejects nested object schemas with unrestricted additionalProperties", () => {
        const resolver = new ToolResolver();

        expect(() =>
            resolver.register("test", {
                tool: {
                    name: "nested_additional",
                    description: "Invalid nested additionalProperties schema tool.",
                    parameters: Type.Object({}, { additionalProperties: false })
                },
                returns: {
                    schema: Type.Object(
                        {
                            nested: Type.Object({ value: Type.String() }, { additionalProperties: true })
                        },
                        { additionalProperties: false }
                    ),
                    toLLMText: () => "ok"
                },
                execute: async () => okResult("nested_additional", "ok")
            })
        ).toThrow(
            'Tool "nested_additional" return schema supports primitives, any, nested objects, arrays, and unions only; additionalProperties must not be true.'
        );
    });

    it("accepts arrays of objects with nested sub-objects", () => {
        const resolver = new ToolResolver();

        expect(() =>
            resolver.register("test", {
                tool: {
                    name: "nested_rows",
                    description: "Nested row schema tool.",
                    parameters: Type.Object({}, { additionalProperties: false })
                },
                returns: {
                    schema: Type.Object(
                        {
                            rows: Type.Array(
                                Type.Object(
                                    {
                                        id: Type.String(),
                                        metrics: Type.Object(
                                            {
                                                score: Type.Number(),
                                                trend: Type.Array(Type.Number())
                                            },
                                            { additionalProperties: false }
                                        )
                                    },
                                    { additionalProperties: false }
                                )
                            )
                        },
                        { additionalProperties: false }
                    ),
                    toLLMText: () => "ok"
                },
                execute: async () => okResult("nested_rows", "ok")
            })
        ).not.toThrow();
    });

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

    it("supports path-aware visibility callbacks", () => {
        const resolver = new ToolResolver();
        resolver.register("test", {
            tool: {
                name: "memory_node_read",
                description: "Read memory node.",
                parameters: Type.Object({}, { additionalProperties: false })
            },
            returns: textReturns,
            visibleByDefault: (context) => context.path.endsWith("/memory/agent-1"),
            execute: async () => okResult("memory_node_read", "ok")
        });

        const memoryTools = resolver.listToolsForAgent(
            toolVisibilityContextCreate({
                path: "/user-1/memory/agent-1",
                config: {
                    foreground: false,
                    name: null,
                    description: null,
                    systemPrompt: null,
                    workspaceDir: null
                }
            })
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
            toolExecutionContextCreate()
        );

        expect(result.typedResult).toEqual({ text: "ok" });
    });

    it("leaves context.print undefined for non-python tool execution", async () => {
        const resolver = new ToolResolver();
        const execute = vi.fn(async (_args: unknown, context: ToolExecutionContext) => {
            expect(context.print).toBeUndefined();
            return okResult("read_file", "ok");
        });
        resolver.register("test", {
            tool: {
                name: "read_file",
                description: "Read file.",
                parameters: Type.Object({ path: Type.String() }, { additionalProperties: false })
            },
            returns: textReturns,
            execute
        });

        const result = await resolver.execute(
            {
                type: "toolCall",
                id: "call-ctx-print",
                name: "read_file",
                arguments: { path: "/tmp/a.txt" }
            },
            toolExecutionContextCreate()
        );

        expect(result.toolMessage.isError).toBe(false);
        expect(execute).toHaveBeenCalledTimes(1);
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

    it("returns executeDeferred handler for registered tools", () => {
        const resolver = new ToolResolver();
        const handler = vi.fn(async () => {});
        resolver.register("test", {
            tool: {
                name: "say",
                description: "Say.",
                parameters: Type.Object({ text: Type.String() }, { additionalProperties: false })
            },
            returns: textReturns,
            execute: async () => okResult("say", "ok"),
            executeDeferred: handler
        });

        expect(resolver.deferredHandlerFor("say")).toBe(handler);
        expect(resolver.deferredHandlerFor("nonexistent")).toBeUndefined();
    });

    it("returns undefined for tools without executeDeferred", () => {
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

        expect(resolver.deferredHandlerFor("read_file")).toBeUndefined();
    });

    it("throws AbortError when execution signal is already aborted", async () => {
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
        const abortController = new AbortController();
        abortController.abort();

        await expect(
            resolver.execute(
                {
                    type: "toolCall",
                    id: "call-3",
                    name: "read_file",
                    arguments: { path: "/tmp/a.txt" }
                },
                toolExecutionContextCreate({ abortSignal: abortController.signal })
            )
        ).rejects.toMatchObject({ name: "AbortError" });
    });

    it("throws AbortError when execution signal aborts during tool execution", async () => {
        const resolver = new ToolResolver();
        resolver.register("test", {
            tool: {
                name: "read_file",
                description: "Read file.",
                parameters: Type.Object({ path: Type.String() }, { additionalProperties: false })
            },
            returns: textReturns,
            execute: vi.fn(async () => {
                return await new Promise<ToolExecutionResult>(() => undefined);
            })
        });
        const abortController = new AbortController();
        const execution = resolver.execute(
            {
                type: "toolCall",
                id: "call-4",
                name: "read_file",
                arguments: { path: "/tmp/a.txt" }
            },
            toolExecutionContextCreate({ abortSignal: abortController.signal })
        );
        abortController.abort();

        await expect(execution).rejects.toMatchObject({ name: "AbortError" });
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
        ...overrides
    };
}

function toolVisibilityContextCreate(overrides: Partial<ToolVisibilityContext> = {}): ToolVisibilityContext {
    return {
        ctx: contextForAgent({ userId: "user-1", agentId: "agent-1" }),
        path: "/user-1/telegram",
        config: {
            foreground: true,
            name: null,
            description: null,
            systemPrompt: null,
            workspaceDir: null
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
