import { Type } from "@sinclair/typebox";
import { describe, expect, it } from "vitest";

import type { ToolExecutionContext, ToolExecutionResult } from "@/types";
import { ToolResolver } from "./toolResolver.js";

const textResultSchema = Type.Object({ text: Type.String() }, { additionalProperties: false });
const textReturns = {
    schema: textResultSchema,
    toLLMText: (result: { text: string }) => result.text
};

describe("ToolResolver", () => {
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
        expect(messageText(result)).toContain('RLM mode only allows calling "run_python".');
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
        fileStore: null as unknown as ToolExecutionContext["fileStore"],
        auth: null as unknown as ToolExecutionContext["auth"],
        logger: console as unknown as ToolExecutionContext["logger"],
        assistant: null,
        permissions: {
            workingDir: "/tmp",
            writeDirs: [],
            readDirs: [],
            network: false,
            events: false
        },
        agent: null as unknown as ToolExecutionContext["agent"],
        agentContext: null as unknown as ToolExecutionContext["agentContext"],
        source: "test",
        messageContext: {},
        agentSystem: null as unknown as ToolExecutionContext["agentSystem"],
        heartbeats: null as unknown as ToolExecutionContext["heartbeats"],
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
